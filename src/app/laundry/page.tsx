
"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Signature, 
  Loader2,
  Trash2,
  FileSearch,
  CheckCircle2,
  Package,
  History,
  Camera,
  WashingMachine,
  CreditCard
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, where } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatAppDate } from "@/lib/utils";
import { reconcileLaundryInvoice, type ReconcileLaundryOutput } from "@/ai/flows/reconcile-laundry-invoice-flow";

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canManageOrders = ["owner", "admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isLinenOpen, setIsLinenOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [auditResult, setAuditResult] = useState<ReconcileLaundryOutput | null>(null);

  const [newItem, setNewItem] = useState({ name: "", type: "guest", hotelRate: "", vendorRate: "" });
  const [newOrder, setNewOrder] = useState({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] as any[] });
  const [newLinenBatch, setNewLinenBatch] = useState({ items: [] as any[] });

  // Data Fetching
  const itemsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_items"), orderBy("itemName"));
  }, [db, entityId]);

  const guestOrdersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const linenBatchesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "linen_laundry_batches"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const resQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "reservations"), where("status", "==", "checked_in"));
  }, [db, entityId]);

  const { data: allItems } = useCollection(itemsQuery);
  const { data: guestOrders, isLoading: ordersLoading } = useCollection(guestOrdersQuery);
  const { data: linenBatches } = useCollection(linenBatchesQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: reservations } = useCollection(resQuery);

  const guestItems = useMemo(() => allItems?.filter(i => i.itemType === 'guest') || [], [allItems]);
  const linenItems = useMemo(() => allItems?.filter(i => i.itemType === 'linen') || [], [allItems]);
  const occupiedRooms = useMemo(() => rooms?.filter(r => r.status.includes('occupied')) || [], [rooms]);

  const handleMarkAsPaid = (orderId: string) => {
    if (!entityId) return;
    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderId), {
      status: "paid",
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Payment Recorded", description: "Laundry order cleared from room account." });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newOrder.roomId || newOrder.items.length === 0) return;
    
    const hotelTotal = newOrder.items.reduce((sum, i) => sum + (i.hotelRate * i.quantity), 0);
    const vendorTotal = newOrder.items.reduce((sum, i) => sum + (i.vendorRate * i.quantity), 0);

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), {
      ...newOrder,
      hotelTotal,
      vendorTotal,
      status: "sent",
      createdAt: new Date().toISOString()
    });
    
    toast({ title: "Order Logged", description: `Sent for Room ${newOrder.roomNumber}.` });
    setIsOrderOpen(false);
    setNewOrder({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] });
  };

  const processReconciliation = async (file: File) => {
    if (!entityId) return;
    setIsReconciling(true);
    setAuditResult(null);

    try {
      // 1. Convert file to Data URI
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 2. Prepare internal records (simulated for period)
      const recordedBatches = linenBatches?.map(b => ({
        date: b.createdAt.split('T')[0],
        items: b.items.map((i: any) => ({
          name: i.itemName,
          quantity: i.quantity,
          rate: i.vendorRate || 0
        }))
      })) || [];

      // 3. Call AI Flow
      const result = await reconcileLaundryInvoice({
        invoicePhotoUri: dataUri,
        recordedBatches: recordedBatches as any
      });

      setAuditResult(result);
      toast({ 
        title: result.isMatch ? "Audit Complete" : "Discrepancy Detected", 
        description: result.summary,
        variant: result.isMatch ? "default" : "destructive"
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "AI Audit Failed", description: "Could not process invoice image." });
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Signature className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Signature Laundry Hub</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Operations & Settlement Audit</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-[10px] font-bold shadow-md" onClick={() => setIsReconcileOpen(true)}>
              <FileSearch className="w-3 h-3 mr-1" /> AI Invoice Audit
            </Button>
          </div>
        </div>

        <Tabs defaultValue="guest-orders" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="guest-orders" className="rounded-lg h-7 text-[10px] px-4">Guest Orders</TabsTrigger>
            <TabsTrigger value="linen-batches" className="rounded-lg h-7 text-[10px] px-4">Linen Batches</TabsTrigger>
            <TabsTrigger value="rates" className="rounded-lg h-7 text-[10px] px-4">Rate Card</TabsTrigger>
          </TabsList>

          <TabsContent value="guest-orders" className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Active Dues Tracking
              </h2>
              {canManageOrders && (
                <Button size="sm" className="h-7 text-[10px] font-bold" onClick={() => setIsOrderOpen(true)}>
                  <Plus className="w-2.5 h-2.5 mr-1" /> Log Room Order
                </Button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="h-8 text-[9px] uppercase font-bold pl-4">Room</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold">Items</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold">Total ₹</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold text-center">Payment</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="animate-spin w-4 h-4 mx-auto" /></TableCell></TableRow>
                  ) : guestOrders?.length ? (
                    guestOrders.map(order => (
                      <TableRow key={order.id} className="hover:bg-secondary/5">
                        <TableCell className="pl-4">
                          <div className="font-bold text-[10px]">{order.roomNumber}</div>
                          <div className="text-[7px] text-muted-foreground truncate max-w-[80px]">{order.guestName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[9px] max-w-[150px] truncate">
                            {order.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-primary">₹{order.hotelTotal}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("text-[7px] uppercase", order.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {order.status !== "paid" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/5" onClick={() => handleMarkAsPaid(order.id)}>
                              <CreditCard className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] text-muted-foreground uppercase font-bold">Clean record</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="rates" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase text-muted-foreground">Price Management</h2>
              {isAdmin && (
                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold" onClick={() => setIsItemOpen(true)}>
                  <Plus className="w-2.5 h-2.5 mr-1" /> Add Service
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-none shadow-sm">
                <CardHeader className="p-3 bg-secondary/20"><CardTitle className="text-[10px] font-bold uppercase">Guest Laundry List</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="h-7 text-[8px] pl-4">Item</TableHead><TableHead className="h-7 text-[8px]">Signature ₹</TableHead><TableHead className="h-7 text-[8px]">Hotel ₹</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {guestItems.map(item => (
                        <TableRow key={item.id}><TableCell className="pl-4 text-[9px] font-bold">{item.itemName}</TableCell><TableCell className="text-[9px]">₹{item.vendorRate}</TableCell><TableCell className="text-[9px] font-bold text-primary">₹{item.hotelRate}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader className="p-3 bg-secondary/20"><CardTitle className="text-[10px] font-bold uppercase">Linen Cleaning Rates</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="h-7 text-[8px] pl-4">Linen</TableHead><TableHead className="h-7 text-[8px]">Vendor Rate ₹</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {linenItems.map(item => (
                        <TableRow key={item.id}><TableCell className="pl-4 text-[9px] font-bold">{item.itemName}</TableCell><TableCell className="text-[9px] font-bold text-primary">₹{item.vendorRate}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="linen-batches" className="space-y-4">
             <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase text-muted-foreground">Linen Flow History</h2>
              <Button size="sm" className="h-7 text-[10px] font-bold" onClick={() => setIsLinenOpen(true)}>
                <Plus className="w-2.5 h-2.5 mr-1" /> Log Linen Dispatch
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {linenBatches?.map(batch => (
                <Card key={batch.id} className="border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="p-3 pb-1 flex flex-row justify-between items-center">
                    <CardTitle className="text-[9px] font-bold">{formatAppDate(batch.createdAt)}</CardTitle>
                    <Badge variant="secondary" className="text-[7px] h-3.5 px-1 uppercase">{batch.status}</Badge>
                  </CardHeader>
                  <CardContent className="p-3 pt-1.5 space-y-2">
                    <div className="bg-secondary/30 p-2 rounded-lg space-y-0.5">
                      {batch.items.map((i: any) => (
                        <div key={i.itemId} className="flex justify-between text-[8px]">
                          <span>{i.itemName}</span>
                          <span className="font-bold">x{i.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* New Guest Order Dialog */}
        <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
          <DialogContent className="sm:max-w-[340px] p-0 overflow-hidden">
            <div className="bg-primary p-4 text-primary-foreground">
              <DialogTitle className="text-sm font-bold">Room Laundry Log</DialogTitle>
              <DialogDescription className="text-[10px] text-primary-foreground/80">Select occupied room to auto-pull guest info</DialogDescription>
            </div>
            <form onSubmit={handleCreateOrder} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Room</Label>
                  <Select onValueChange={(val) => {
                    const room = occupiedRooms.find(r => r.id === val);
                    const res = reservations?.find(res => res.roomNumber?.toString() === room?.roomNumber?.toString());
                    setNewOrder({...newOrder, roomId: val, roomNumber: room?.roomNumber, guestName: res?.guestName || "Unknown", reservationId: res?.id || ""});
                  }}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {occupiedRooms.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">Room {r.roomNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Guest Account</Label>
                  <div className="h-7 px-2 bg-secondary/50 rounded flex items-center text-[9px] font-bold truncate">{newOrder.guestName || "..."}</div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase font-bold">Item Picker</Label>
                <ScrollArea className="h-24 border rounded-lg bg-secondary/10 p-1">
                  {guestItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-1.5 mb-1 bg-white border rounded shadow-sm">
                      <span className="text-[9px] font-bold flex-1 truncate">{item.itemName}</span>
                      <Button type="button" size="icon" variant="secondary" className="h-5 w-5 ml-1" onClick={() => {
                        const existing = newOrder.items.find(i => i.itemId === item.id);
                        if (existing) {
                          setNewOrder({...newOrder, items: newOrder.items.map(i => i.itemId === item.id ? {...i, quantity: i.quantity + 1} : i)});
                        } else {
                          setNewOrder({...newOrder, items: [...newOrder.items, { ...item, itemId: item.id, quantity: 1 }]});
                        }
                      }}><Plus className="w-2.5 h-2.5" /></Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {newOrder.items.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Basket (Total: ₹{newOrder.items.reduce((s,i) => s + (i.hotelRate * i.quantity), 0)})</Label>
                  <ScrollArea className="h-24 border rounded-lg p-1">
                    {newOrder.items.map(i => (
                      <div key={i.itemId} className="flex items-center justify-between text-[10px] p-1 border-b">
                        <span className="truncate flex-1">{i.itemName}</span>
                        <div className="flex items-center gap-1">
                          <Input type="number" className="h-5 w-8 p-0 text-center text-[9px]" value={i.quantity} onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setNewOrder({...newOrder, items: newOrder.items.map(item => item.itemId === i.itemId ? {...item, quantity: val} : item)});
                          }} />
                          <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => setNewOrder({...newOrder, items: newOrder.items.filter(item => item.itemId !== i.itemId)})}><Trash2 className="w-2.5 h-2.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <Button type="submit" className="w-full h-8 font-bold text-[10px]">Log Order to Folio</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* AI Audit Dialog */}
        <Dialog open={isReconcileOpen} onOpenChange={setIsReconcileOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Signature className="w-4 h-4 text-primary" /> Signature Audit AI
              </DialogTitle>
              <DialogDescription className="text-[10px]">Compare Signature Laundry invoice photos against internal batch logs.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-2 group cursor-pointer hover:border-primary relative transition-colors">
                <div className="p-3 bg-secondary rounded-full w-fit mx-auto group-hover:bg-primary/10">
                  {isReconciling ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Camera className="w-5 h-5 text-muted-foreground group-hover:text-primary" />}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold">Snapshot Invoice</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Upload photo for matching</p>
                </div>
                <input type="file" className="hidden" id="audit-upload" accept="image/*" onChange={(e) => e.target.files?.[0] && processReconciliation(e.target.files[0])} />
                <Label htmlFor="audit-upload" className="absolute inset-0 cursor-pointer" />
              </div>
              {auditResult && (
                <ScrollArea className="h-[200px] border rounded-lg p-3 text-[10px] space-y-2">
                  <div className="flex justify-between items-center font-bold uppercase pb-1 border-b">
                    <span>Audit Result</span>
                    <Badge variant={auditResult.isMatch ? "outline" : "destructive"} className="h-4 text-[7px]">{auditResult.isMatch ? "Match" : "Mismatch"}</Badge>
                  </div>
                  <p className="font-medium whitespace-pre-wrap">{auditResult.summary}</p>
                  {auditResult.discrepancies?.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className="font-black uppercase text-[8px] text-rose-600">Discrepancies:</p>
                      {auditResult.discrepancies.map((d, i) => (
                        <div key={i} className="p-1.5 bg-rose-50 rounded border border-rose-100 text-[9px]">
                          <span className="font-bold">{d.itemName} ({d.date}):</span> {d.issue}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

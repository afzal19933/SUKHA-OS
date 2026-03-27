
"use client";

import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  WashingMachine, 
  Truck, 
  History, 
  Search, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  MoreVertical,
  Trash2,
  AlertTriangle,
  IndianRupee,
  ShoppingBag,
  Package,
  Layers,
  FileText,
  Sparkles,
  ClipboardList,
  ChevronRight,
  ArrowRight,
  Receipt,
  UserCheck,
  Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, where, limit, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { reconcileLaundryInvoice } from "@/ai/flows/reconcile-laundry-invoice-flow";

const ORDER_STATUSES = ["sent", "in_progress", "completed", "delivered", "paid"];

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";
  const canManage = ["admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  // UI State
  const [activeTab, setActiveTab] = useState("orders");
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isBatchOpen, setIsLinenOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isAIAuditOpen, setIsAIAuditOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);

  // Form States
  const [newOrder, setNewOrder] = useState({ roomId: "", roomNumber: "", guestName: "", items: [] as any[] });
  const [newBatch, setNewBatch] = useState({ items: [] as any[], notes: "" });
  const [newRate, setNewRate] = useState({ itemName: "", rate: "", itemType: "guest" });
  const [newPayment, setNewPayment] = useState({ amount: "", method: "UPI", reference: "", notes: "" });

  // Data Fetching
  const ordersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const batchesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "linen_laundry_batches"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_vendor_payments"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const ratesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_items"), orderBy("itemName"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber"));
  }, [db, entityId]);

  const { data: guestOrders, isLoading: ordersLoading } = useCollection(ordersQuery);
  const { data: linenBatches, isLoading: batchesLoading } = useCollection(batchesQuery);
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery);
  const { data: rates, isLoading: ratesLoading } = useCollection(ratesQuery);
  const { data: rooms } = useCollection(roomsQuery);

  // Computed Data
  const duesTracker = useMemo(() => {
    if (!guestOrders) return [];
    const tracker: Record<string, any> = {};
    guestOrders.forEach(order => {
      if (order.status !== 'paid') {
        const key = order.roomId || order.roomNumber;
        if (!tracker[key]) {
          tracker[key] = { 
            room: order.roomNumber, 
            guest: order.guestName, 
            totalDue: 0, 
            lastOrder: order.createdAt,
            orderIds: [] 
          };
        }
        tracker[key].totalDue += (order.hotelTotal || 0);
        tracker[key].orderIds.push(order.id);
      }
    });
    return Object.values(tracker);
  }, [guestOrders]);

  // Handlers
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newOrder.roomNumber) return;

    const selectedRoom = rooms?.find(r => r.roomNumber === newOrder.roomNumber);
    const orderData = {
      ...newOrder,
      roomId: selectedRoom?.id || "",
      status: "sent",
      hotelTotal: newOrder.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderData);
    toast({ title: "Laundry Order Logged" });
    setIsOrderOpen(false);
    setNewOrder({ roomId: "", roomNumber: "", guestName: "", items: [] });
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!entityId) return;
    await updateDoc(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    toast({ title: `Order status: ${newStatus}` });
  };

  const handleDeleteOrder = async () => {
    if (!entityId || !orderToDelete) return;
    await deleteDoc(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderToDelete.id));
    toast({ title: "Order deleted" });
    setOrderToDelete(null);
  };

  const handleSettleGuest = async (dues: any) => {
    if (!entityId) return;
    for (const id of dues.orderIds) {
      await updateDoc(doc(db, "hotel_properties", entityId, "guest_laundry_orders", id), {
        status: 'paid',
        updatedAt: new Date().toISOString()
      });
    }
    toast({ title: "Dues settled", description: `Cleared ₹${dues.totalDue} for Room ${dues.room}` });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Signature Laundry Hub</h1>
            <p className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1">Operations & Settlement Audit</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              className="h-11 px-6 bg-[#5F5FA7] hover:bg-[#4F4F8F] text-white font-black uppercase text-[11px] tracking-widest shadow-xl rounded-xl"
              onClick={() => setIsAIAuditOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" /> AI Invoice Audit
            </Button>
            <div className="flex items-center gap-2 px-4 h-11 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-tight">Vendor Connected</span>
            </div>
          </div>
        </div>

        {/* Global Tabs */}
        <Tabs defaultValue="orders" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <TabsList className="bg-white border p-1.5 rounded-[1.5rem] h-14 shadow-sm w-full md:w-auto">
              <TabsTrigger value="orders" className="rounded-xl h-11 px-6 text-[11px] font-bold uppercase">Active Orders</TabsTrigger>
              <TabsTrigger value="dues" className="rounded-xl h-11 px-6 text-[11px] font-bold uppercase">Guest Dues Tracker</TabsTrigger>
              <TabsTrigger value="linen" className="rounded-xl h-11 px-6 text-[11px] font-bold uppercase">Linen Batches</TabsTrigger>
              <TabsTrigger value="vendor" className="rounded-xl h-11 px-6 text-[11px] font-bold uppercase">Vendor Accounts</TabsTrigger>
              <TabsTrigger value="rates" className="rounded-xl h-11 px-6 text-[11px] font-bold uppercase">Rate Card</TabsTrigger>
            </TabsList>

            {activeTab === 'orders' && (
              <Button 
                onClick={() => setIsOrderOpen(true)}
                className="h-11 px-8 bg-[#5F5FA7] hover:bg-[#4F4F8F] font-black uppercase text-[11px] tracking-widest shadow-xl rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Log Room Order
              </Button>
            )}
          </div>

          {/* ============ ACTIVE ORDERS TAB ============ */}
          <TabsContent value="orders" className="animate-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-14 text-[10px] font-black uppercase pl-10 text-primary-foreground">Room</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-primary-foreground">Items & Content</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Billed ₹</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Status</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase pr-10 text-right text-primary-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></TableCell></TableRow>
                  ) : guestOrders && guestOrders.length > 0 ? (
                    guestOrders.filter(o => o.status !== 'paid').map((order) => (
                      <TableRow key={order.id} className="group hover:bg-primary/5 transition-colors border-b border-secondary/50">
                        <TableCell className="pl-10 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-primary">Room {order.roomNumber}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{order.guestName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[11px] font-medium leading-relaxed max-w-md">
                            {order.items?.map((item: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center bg-secondary/50 px-2 py-0.5 rounded-lg mr-1.5 mb-1">
                                {item.quantity}x {item.itemName}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-black text-slate-800">₹{(order.hotelTotal || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select onValueChange={(val) => handleUpdateStatus(order.id, val)} value={order.status}>
                            <SelectTrigger className="h-8 w-32 mx-auto rounded-full text-[9px] font-black uppercase border-none shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {ORDER_STATUSES.map(s => <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="pr-10 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100" onClick={() => setOrderToDelete(order)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-32 opacity-20 flex flex-col items-center"><WashingMachine className="w-12 h-12 mb-2" /><p className="text-[11px] font-black uppercase">No active guest orders</p></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ============ GUEST DUES TAB ============ */}
          <TabsContent value="dues">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {duesTracker.map((dues: any, idx: number) => (
                <Card key={idx} className="border-none shadow-sm rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all">
                  <CardHeader className="bg-[#5F5FA7] p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div className="bg-white/20 p-2 rounded-xl"><UserCheck className="w-5 h-5" /></div>
                      <Badge className="bg-white/20 text-white border-none text-[10px] font-black uppercase">Unpaid Folio</Badge>
                    </div>
                    <div className="mt-4">
                      <CardTitle className="text-lg font-black uppercase tracking-tight">{dues.guest}</CardTitle>
                      <CardDescription className="text-white/70 font-bold uppercase text-[10px]">Room {dues.room}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Outstanding Due</p>
                        <p className="text-2xl font-black text-rose-600">₹{dues.totalDue.toLocaleString()}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Last Request</p>
                        <p className="text-[11px] font-bold">{formatAppDate(dues.lastOrder)}</p>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest"
                      onClick={() => handleSettleGuest(dues)}
                    >
                      <Receipt className="w-4 h-4 mr-2" /> Settle Payment
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {duesTracker.length === 0 && (
                <div className="col-span-full py-32 text-center opacity-30 flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-500" />
                  <p className="text-[11px] font-black uppercase">All guest accounts are clear</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ============ LINEN BATCHES TAB ============ */}
          <TabsContent value="linen">
            <div className="flex justify-end mb-4">
              <Button size="sm" className="h-9 px-6 bg-slate-800 text-white font-bold uppercase text-[10px] rounded-xl" onClick={() => setIsLinenOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-2" /> Dispatch Linen Batch
              </Button>
            </div>
            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-800 text-white">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 pl-10 text-[10px] font-black uppercase text-white">Batch ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white">Content Inventory</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Dispatch Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Expected Return</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linenBatches?.map((batch) => (
                    <TableRow key={batch.id} className="border-b border-secondary/50">
                      <TableCell className="pl-10 font-mono text-[11px] font-bold text-slate-600">#{batch.id.slice(-6).toUpperCase()}</TableCell>
                      <TableCell>
                        <div className="text-[11px] font-medium py-4">
                          {batch.items?.map((i: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="mr-1.5 mb-1 bg-slate-50 text-[10px]">{i.quantity}x {i.itemName}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-[11px] font-bold">{formatAppDate(batch.createdAt)}</TableCell>
                      <TableCell className="text-center text-[11px] font-bold text-muted-foreground">{batch.returnDate ? formatAppDate(batch.returnDate) : "TBD"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-[9px] font-black uppercase", batch.status === 'returned' ? "bg-emerald-500" : "bg-amber-500")}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ============ VENDOR ACCOUNTS TAB ============ */}
          <TabsContent value="vendor">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-slate-900 text-white">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Total Outbound Billed</CardTitle>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-black">₹{guestOrders?.reduce((acc, o) => acc + (o.hotelTotal || 0), 0).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase">All Time</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500">Unpaid Vendor Balance</p>
                      <p className="text-xl font-black text-rose-400">₹{(guestOrders?.reduce((acc, o) => acc + (o.hotelTotal || 0), 0) - payments?.reduce((acc, p) => acc + (p.amount || 0), 0)).toLocaleString()}</p>
                    </div>
                    <Button size="sm" className="h-9 px-6 bg-white text-slate-900 font-black text-[10px] uppercase rounded-xl" onClick={() => setIsPaymentOpen(true)}>
                      Record Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden flex flex-col">
                <div className="p-6 border-b bg-secondary/20"><h3 className="text-xs font-black uppercase tracking-widest">Recent Settlements</h3></div>
                <ScrollArea className="flex-1 max-h-[300px]">
                  <Table>
                    <TableBody>
                      {payments?.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="pl-6 font-bold text-[11px]">{formatAppDate(p.createdAt)}</TableCell>
                          <TableCell className="text-[11px] font-medium text-muted-foreground">{p.method} • {p.reference || "No Ref"}</TableCell>
                          <TableCell className="text-right pr-6 font-black text-emerald-600">₹{p.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* ============ RATE CARD TAB ============ */}
          <TabsContent value="rates">
            <div className="flex justify-end mb-4">
              <Button size="sm" className="h-9 px-6 bg-[#5F5FA7] text-white font-bold uppercase text-[10px] rounded-xl" onClick={() => setIsRateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-2" /> Add Item
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rates?.map((rate) => (
                <Card key={rate.id} className="border-none shadow-sm rounded-2xl group hover:scale-[1.02] transition-all">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/5 p-2.5 rounded-xl text-primary"><ShoppingBag className="w-4.5 h-4.5" /></div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">{rate.itemName}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{rate.itemType} Service</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">₹{rate.rate}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase">per piece</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* LOG ROOM ORDER DIALOG */}
        <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-[#5F5FA7] p-8 text-white">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Log Guest Order</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase text-white/70 mt-1">Record items collected from guest room.</DialogDescription>
            </div>
            <form onSubmit={handleCreateOrder} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Room Number</Label>
                  <Select onValueChange={(val) => setNewOrder({...newOrder, roomNumber: val})}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-none font-bold"><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms?.map(r => <SelectItem key={r.id} value={r.roomNumber}>{r.roomNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Guest Name</Label>
                  <Input value={newOrder.guestName} onChange={e => setNewOrder({...newOrder, guestName: e.target.value})} placeholder="Mohammed Aslam" className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Order Items</Label>
                  <Button type="button" variant="ghost" className="h-6 text-[9px] font-black text-primary" onClick={() => setNewOrder({...newOrder, items: [...newOrder.items, { itemName: "", quantity: 1, rate: 0 }]})}>+ Add Item</Button>
                </div>
                <ScrollArea className="h-40 border rounded-2xl p-2 bg-secondary/30">
                  {newOrder.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <Select onValueChange={(val) => {
                        const rateItem = rates?.find(r => r.itemName === val);
                        const updated = [...newOrder.items];
                        updated[idx] = { ...updated[idx], itemName: val, rate: rateItem?.rate || 0 };
                        setNewOrder({...newOrder, items: updated});
                      }}>
                        <SelectTrigger className="flex-1 h-10 rounded-xl bg-white border-none text-xs"><SelectValue placeholder="Item" /></SelectTrigger>
                        <SelectContent>{rates?.filter(r => r.itemType === 'guest').map(r => <SelectItem key={r.id} value={r.itemName}>{r.itemName}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" className="w-16 h-10 rounded-xl bg-white border-none text-center" value={item.quantity} onChange={e => {
                        const updated = [...newOrder.items];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setNewOrder({...newOrder, items: updated});
                      }} />
                      <Button type="button" variant="ghost" className="h-10 text-rose-500" onClick={() => setNewOrder({...newOrder, items: newOrder.items.filter((_, i) => i !== idx)})}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-2xl">
                <span className="text-[11px] font-black uppercase text-primary">Estimated Total</span>
                <span className="text-xl font-black text-primary">₹{newOrder.items.reduce((acc, i) => acc + (i.quantity * i.rate), 0).toLocaleString()}</span>
              </div>

              <Button type="submit" className="w-full h-14 bg-[#5F5FA7] hover:bg-[#4F4F8F] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20">Dispatch Order</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION */}
        <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
          <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600"><AlertTriangle className="w-5 h-5" /> Purge Laundry Order</AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold uppercase tracking-tight">Are you absolutely sure? This will permanently remove the record for Room {orderToDelete?.roomNumber}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-black text-[10px] uppercase">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteOrder} className="bg-rose-600 hover:bg-rose-700 rounded-xl font-black text-[10px] uppercase">Confirm Purge</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardContent className="p-6 flex items-center gap-5">
        <div className={cn("p-4 rounded-2xl", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
          <h3 className="text-2xl font-black mt-0.5">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

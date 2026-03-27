"use client";

import { useState, useMemo } from "react";
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
  FileText
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
import { cn, formatAppDate, formatAppTime, safeAsync } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, where, limit } from "firebase/firestore";
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

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";
  const canManageOrders = ["admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [activeTab, setActiveTab] = useState("orders");
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isLinenOpen, setIsLinenOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newOrder, setNewOrder] = useState({
    roomId: "",
    roomNumber: "",
    guestName: "",
    reservationId: "",
    items: [] as any[],
  });

  const [newVendorPayment, setNewVendorPayment] = useState({
    amount: "",
    method: "UPI",
    reference: "",
    notes: "",
    category: "hotel",
  });

  // Data Fetching
  const guestOrdersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "guest_laundry_orders"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "laundry_vendor_payments"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
  }, [db, entityId]);

  const { data: guestOrders, isLoading: ordersLoading } = useCollection(guestOrdersQuery);
  const { data: vendorPayments, isLoading: paymentsLoading } = useCollection(paymentsQuery);

  const stats = useMemo(() => {
    if (!guestOrders) return { pending: 0, revenue: 0, deliveredToday: 0 };
    return guestOrders.reduce((acc, order) => {
      if (order?.status === "sent") acc.pending++;
      if (order?.status === "paid") acc.revenue += (order?.hotelTotal || 0);
      return acc;
    }, { pending: 0, revenue: 0, deliveredToday: 0 });
  }, [guestOrders]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newOrder.roomId || !canManageOrders) return;

    await safeAsync(async () => {
      addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), {
        ...newOrder,
        status: "sent",
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Order Dispatched" });
      setIsOrderOpen(false);
    }, null, "CREATE_LAUNDRY_ORDER");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newVendorPayment.amount || !canEdit) return;

    await safeAsync(async () => {
      addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "laundry_vendor_payments"), {
        amount: parseFloat(newVendorPayment.amount),
        method: newVendorPayment.method,
        reference: newVendorPayment.reference,
        notes: newVendorPayment.notes,
        category: newVendorPayment.category,
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Payment Recorded" });
      setIsPaymentOpen(false);
    }, null, "RECORD_LAUNDRY_PAYMENT");
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Laundry Management</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1">Signature Laundry Operations Hub</p>
          </div>
          <div className="flex gap-2">
            {canManageOrders && (
              <Button className="h-11 px-6 font-black uppercase text-[11px] tracking-widest shadow-xl rounded-xl" onClick={() => setIsOrderOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Guest Order
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" className="h-11 px-6 font-black uppercase text-[11px] tracking-widest rounded-xl bg-white" onClick={() => setIsPaymentOpen(true)}>
                <IndianRupee className="w-4 h-4 mr-2" /> Vendor Payment
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Orders Pending" value={stats.pending} icon={Truck} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Collected Revenue" value={`₹${stats.revenue.toLocaleString()}`} icon={IndianRupee} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Vendor Status" value="Active" icon={CheckCircle2} color="text-primary" bg="bg-primary/5" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-12 shadow-sm">
            <TabsTrigger value="orders" className="rounded-lg h-10 px-8 text-[11px] font-bold uppercase">Guest Orders</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg h-10 px-8 text-[11px] font-bold uppercase">Vendor Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-14 text-[10px] font-black uppercase pl-10 text-primary-foreground">Order Date</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-primary-foreground">Room & Guest</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Items</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-right text-primary-foreground">Total ₹</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-24"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></TableCell></TableRow>
                  ) : guestOrders && guestOrders.length > 0 ? (
                    guestOrders.map((order) => (
                      <TableRow key={order.id} className="group hover:bg-primary/5 transition-colors border-b border-secondary/50">
                        <TableCell className="pl-10 py-5">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase">{order?.createdAt ? formatAppDate(order.createdAt) : "N/A"}</span>
                            <span className="text-[9px] font-bold text-muted-foreground">{order?.createdAt ? formatAppTime(order.createdAt) : ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-slate-800">Room {order?.roomNumber ?? "N/A"}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{order?.guestName ?? "Guest"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[11px] font-bold">{(order?.items ?? []).length} Units</span>
                        </TableCell>
                        <TableCell className="text-right font-black text-primary">₹{(order?.hotelTotal || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(
                            "text-[9px] font-black uppercase px-3 h-6 rounded-xl",
                            order?.status === 'paid' ? "bg-emerald-500" : 
                            order?.status === 'sent' ? "bg-amber-500" : "bg-slate-500"
                          )}>
                            {order?.status ?? "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-10 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-32 opacity-20">
                        <WashingMachine className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-[11px] font-black uppercase">No active laundry orders</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="h-14 text-[10px] font-black uppercase pl-10">Payment Date</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase">Category</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-center">Method</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-right">Amount ₹</TableHead>
                    <TableHead className="h-14 text-[10px] font-black uppercase text-right pr-10">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></TableCell></TableRow>
                  ) : vendorPayments && vendorPayments.length > 0 ? (
                    vendorPayments.map((p) => (
                      <TableRow key={p.id} className="border-b border-secondary/50">
                        <TableCell className="pl-10 py-5">
                          <span className="text-[11px] font-black uppercase">{p?.createdAt ? formatAppDate(p.createdAt) : "N/A"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-black uppercase bg-secondary/50 border-none">{p?.category ?? "General"}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-600 text-[11px]">{p?.method ?? "N/A"}</TableCell>
                        <TableCell className="text-right font-black text-rose-600">₹{(p?.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-10 font-mono text-[10px] text-muted-foreground">{p?.reference || "N/A"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-32 opacity-20">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-[11px] font-black uppercase">No vendor payment records</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Order Dialog */}
        <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 overflow-hidden">
            <div className="bg-primary p-8 text-white">
              <DialogTitle className="text-xl font-black uppercase">Dispatch Guest Laundry</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase text-white/70 mt-1">Record a new outbound order to Signature Laundry.</DialogDescription>
            </div>
            <form onSubmit={handleCreateOrder} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Room Number</Label>
                  <Input placeholder="Ex: 101" value={newOrder.roomNumber} onChange={e => setNewOrder({...newOrder, roomNumber: e.target.value})} required className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Guest Name</Label>
                  <Input placeholder="Guest Full Name" value={newOrder.guestName} onChange={e => setNewOrder({...newOrder, guestName: e.target.value})} required className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                </div>
              </div>
              <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20">Dispatch Order</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] p-0 overflow-hidden">
            <div className="bg-slate-900 p-8 text-white">
              <DialogTitle className="text-xl font-black uppercase">Record Vendor Payment</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase text-white/70 mt-1">Log payments made to Signature Laundry services.</DialogDescription>
            </div>
            <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Payment Amount (₹)</Label>
                <Input type="number" placeholder="0.00" value={newVendorPayment.amount} onChange={e => setNewVendorPayment({...newVendorPayment, amount: e.target.value})} required className="h-11 rounded-xl bg-secondary/50 border-none font-black text-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Method</Label>
                  <Select value={newVendorPayment.method} onValueChange={v => setNewVendorPayment({...newVendorPayment, method: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/50 border-none font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="UPI">UPI / PhonePe</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BANK">Bank Transfer</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Reference</Label>
                  <Input placeholder="Ref ID" value={newVendorPayment.reference} onChange={e => setNewVendorPayment({...newVendorPayment, reference: e.target.value})} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                </div>
              </div>
              <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-200 bg-slate-900 hover:bg-black">Commit Payment Record</Button>
            </form>
          </DialogContent>
        </Dialog>
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

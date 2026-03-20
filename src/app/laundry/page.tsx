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
  CreditCard,
  Truck,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  AlertCircle,
  Building2,
  Users,
  Wallet,
  ArrowDownToLine
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
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
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

  const canEdit = currentUserRole === "admin";
  const canManageOrders = ["admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isLinenOpen, setIsLinenOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [auditResult, setAuditResult] = useState<ReconcileLaundryOutput | null>(null);

  const [newItem, setNewItem] = useState({ name: "", type: "guest", hotelRate: "", vendorRate: "" });
  const [newOrder, setNewOrder] = useState({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] as any[] });
  const [newLinenBatch, setNewLinenBatch] = useState({ items: [] as any[] });
  const [newVendorPayment, setNewVendorPayment] = useState({ amount: "", method: "UPI", reference: "", notes: "", category: "hotel" });

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

  const paymentsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_vendor_payments"), orderBy("paymentDate", "desc"));
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
  const { data: vendorPayments } = useCollection(paymentsQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: reservations } = useCollection(resQuery);

  const guestItems = useMemo(() => allItems?.filter(i => i.itemType === 'guest') || [], [allItems]);
  const linenItems = useMemo(() => allItems?.filter(i => i.itemType === 'linen') || [], [allItems]);
  const occupiedRooms = useMemo(() => rooms?.filter(r => r.status.includes('occupied')) || [], [rooms]);

  const guestDuesSummary = useMemo(() => {
    if (!guestOrders) return [];
    const summaryMap: Record<string, any> = {};
    guestOrders.forEach(order => {
      const key = `${order.roomId}_${order.guestName}`;
      if (!summaryMap[key]) {
        summaryMap[key] = { roomId: order.roomId, roomNumber: order.roomNumber, guestName: order.guestName, totalBilled: 0, totalPaid: 0, outstanding: 0, orderCount: 0 };
      }
      summaryMap[key].totalBilled += (order.hotelTotal || 0);
      if (order.status === 'paid') summaryMap[key].totalPaid += (order.hotelTotal || 0);
      summaryMap[key].orderCount++;
    });
    return Object.values(summaryMap).map(s => ({ ...s, outstanding: s.totalBilled - s.totalPaid })).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [guestOrders]);

  const accountingStats = useMemo(() => {
    const guestLiability = guestOrders?.reduce((acc, order) => acc + (order.vendorTotal || 0), 0) || 0;
    const guestPayments = vendorPayments?.filter(p => p.category === 'guest').reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
    const hotelLiability = linenBatches?.reduce((acc, batch) => acc + (batch.items?.reduce((sum: number, item: any) => sum + (item.vendorRate * item.quantity), 0) || 0), 0) || 0;
    const hotelPayments = vendorPayments?.filter(p => p.category === 'hotel').reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
    return { 
      totalLiability: guestLiability + hotelLiability, 
      totalPayments: guestPayments + hotelPayments, 
      totalOutstanding: (guestLiability + hotelLiability) - (guestPayments + hotelPayments),
      guestLiability, guestPayments, guestOutstanding: guestLiability - guestPayments,
      hotelLiability, hotelPayments, hotelOutstanding: hotelLiability - hotelPayments
    };
  }, [guestOrders, linenBatches, vendorPayments]);

  const handleMarkAsPaid = (orderId: string) => {
    if (!entityId || !canManageOrders) return;
    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderId), { status: "paid", updatedAt: new Date().toISOString() });
    toast({ title: "Payment Recorded" });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newOrder.roomId || newOrder.items.length === 0 || !canManageOrders) return;
    const hotelTotal = newOrder.items.reduce((sum, i) => sum + (i.hotelRate * i.quantity), 0);
    const vendorTotal = newOrder.items.reduce((sum, i) => sum + (i.vendorRate * i.quantity), 0);
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), { ...newOrder, hotelTotal, vendorTotal, status: "sent", createdAt: new Date().toISOString() });
    setIsOrderOpen(false);
    setNewOrder({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] });
  };

  const handleCreateLinenBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || newLinenBatch.items.length === 0 || !canManageOrders) return;
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "linen_laundry_batches"), { items: newLinenBatch.items, status: "sent", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setIsLinenOpen(false);
    setNewLinenBatch({ items: [] });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newVendorPayment.amount || !canEdit) return;
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "laundry_vendor_payments"), { amount: parseFloat(newVendorPayment.amount), paymentMethod: newVendorPayment.method, reference: newVendorPayment.reference, notes: newVendorPayment.notes, category: newVendorPayment.category, paymentDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
    setIsPaymentOpen(false);
    setNewVendorPayment({ amount: "", method: "UPI", reference: "", notes: "", category: "hotel" });
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl"><Signature className="w-5 h-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Signature Laundry Hub</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Operations & Settlement Audit</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-[10px] font-bold shadow-md" onClick={() => setIsReconcileOpen(true)}><FileSearch className="w-3 h-3 mr-1" /> AI Invoice Audit</Button>
          </div>
        </div>

        <Tabs defaultValue="guest-orders" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="guest-orders" className="rounded-lg h-7 text-[10px] px-4">Active Orders</TabsTrigger>
            <TabsTrigger value="guest-dues" className="rounded-lg h-7 text-[10px] px-4">Guest Dues Tracker</TabsTrigger>
            <TabsTrigger value="linen-batches" className="rounded-lg h-7 text-[10px] px-4">Linen Batches</TabsTrigger>
            <TabsTrigger value="accounts" className="rounded-lg h-7 text-[10px] px-4">Vendor Accounts</TabsTrigger>
            <TabsTrigger value="rates" className="rounded-lg h-7 text-[10px] px-4">Rate Card</TabsTrigger>
          </TabsList>

          <TabsContent value="guest-orders" className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Package className="w-3 h-3" /> Recent Transactions</h2>
              {canManageOrders && <Button size="sm" className="h-7 text-[10px] font-bold" onClick={() => setIsOrderOpen(true)}><Plus className="w-2.5 h-2.5 mr-1" /> Log Room Order</Button>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow><TableHead className="h-8 text-[9px] uppercase font-bold pl-4">Room</TableHead><TableHead className="h-8 text-[9px] uppercase font-bold">Items</TableHead><TableHead className="h-8 text-[9px] uppercase font-bold">Billed ₹</TableHead><TableHead className="h-8 text-[9px] uppercase font-bold text-center">Status</TableHead><TableHead className="h-8 text-[9px] uppercase font-bold text-right pr-4">Action</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="animate-spin w-4 h-4 mx-auto" /></TableCell></TableRow>
                  ) : guestOrders?.map(order => (
                    <TableRow key={order.id} className="hover:bg-secondary/5">
                      <TableCell className="pl-4"><div className="font-bold text-[10px]">{order.roomNumber}</div><div className="text-[7px] text-muted-foreground truncate max-w-[80px]">{order.guestName}</div></TableCell>
                      <TableCell><div className="text-[9px] max-w-[150px] truncate">{order.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(", ")}</div></TableCell>
                      <TableCell className="text-[10px] font-bold text-primary">₹{order.hotelTotal}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className={cn("text-[7px] uppercase", order.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{order.status}</Badge></TableCell>
                      <TableCell className="text-right pr-4">{canManageOrders && order.status !== "paid" && <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => handleMarkAsPaid(order.id)}><CreditCard className="w-3 h-3" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary"><TrendingUp className="w-5 h-5" /></div>
                  <div><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Vendor Liability</p><h3 className="text-lg font-black">₹{accountingStats.totalLiability.toLocaleString()}</h3></div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-emerald-50">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                  <div><p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">Total Payments</p><h3 className="text-lg font-black">₹{accountingStats.totalPayments.toLocaleString()}</h3></div>
                </CardContent>
              </Card>
              <Card className={cn("border-none shadow-sm", accountingStats.totalOutstanding > 0 ? "bg-rose-50" : "bg-emerald-50")}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("p-3 rounded-2xl", accountingStats.totalOutstanding > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}><AlertCircle className="w-5 h-5" /></div>
                  <div><p className={cn("text-[9px] font-black uppercase tracking-widest", accountingStats.totalOutstanding > 0 ? "text-rose-600/70" : "text-emerald-600/70")}>Vendor Outstanding</p><h3 className={cn("text-lg font-black", accountingStats.totalOutstanding > 0 ? "text-rose-700" : "text-emerald-700")}>₹{accountingStats.totalOutstanding.toLocaleString()}</h3></div>
                </CardContent>
              </Card>
            </div>
            {canEdit && (
              <div className="flex justify-end"><Button size="sm" className="h-8 text-[10px] font-bold" onClick={() => setIsPaymentOpen(true)}><ArrowUpRight className="w-3 h-3 mr-1.5" /> Record Vendor Payment</Button></div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

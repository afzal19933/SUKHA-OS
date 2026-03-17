
"use client";

import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Building2,
  Hospital,
  ArrowRight,
  LayoutDashboard,
  Receipt,
  History,
  CreditCard,
  PieChart,
  Settings2,
  ChevronRight,
  Loader2,
  Save,
  Percent,
  BarChart3,
  WashingMachine,
  Wallet,
  CalendarDays,
  FilterX,
  Calendar as CalendarIcon
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { doc, setDoc } from "firebase/firestore";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell as ReCell
} from "recharts";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const SIDEBAR_ITEMS = [
  { id: 'overview', label: 'Financial Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Sales', icon: Receipt },
  { id: 'laundry_revenue', label: 'Laundry Revenue', icon: WashingMachine },
  { id: 'ayuraccounts', label: 'Ayursiha Accounts', icon: Hospital },
  { id: 'expenses', label: 'Operating Expenses', icon: CreditCard },
  { id: 'reports', label: 'Analytics Reports', icon: BarChart3 },
  { id: 'settings', label: 'Tax Settings', icon: Settings2 },
];

const COLORS = ['#5F5FA7', '#10b981', '#f59e0b', '#e11d48', '#334155'];

export default function AccountingPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('overview');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Global Date Filtering State
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  // Data fetching
  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "invoices"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const laundryQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const expenseQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "expenses"), orderBy("date", "desc"));
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const gstRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId, "gst_settings", "default");
  }, [db, entityId]);

  const { data: invoices, isLoading: invLoading } = useCollection(invoiceQuery);
  const { data: laundryOrders, isLoading: laundryLoading } = useCollection(laundryQuery);
  const { data: expenses, isLoading: expLoading } = useCollection(expenseQuery);
  const { data: property } = useDoc(propertyRef);
  const { data: gst } = useDoc(gstRef);

  const [gstForm, setGstForm] = useState({ 
    gstin: "", 
    sacCode: "", 
    roomGstRate: "5", 
    roomCgstRate: "2.5", 
    roomSgstRate: "2.5",
    serviceGstRate: "18",
    serviceCgstRate: "9",
    serviceSgstRate: "9"
  });

  useEffect(() => {
    if (gst) {
      setGstForm({
        gstin: gst.gstin || "",
        sacCode: gst.sacCode || "",
        roomGstRate: gst.roomGstRate?.toString() || "5",
        roomCgstRate: gst.roomCgstRate?.toString() || "2.5",
        roomSgstRate: gst.roomSgstRate?.toString() || "2.5",
        serviceGstRate: gst.serviceGstRate?.toString() || "18",
        serviceCgstRate: gst.serviceCgstRate?.toString() || "9",
        serviceSgstRate: gst.serviceSgstRate?.toString() || "9"
      });
    }
  }, [gst]);

  // Filtering Logic
  const isWithinFilter = (dateInput: string) => {
    if (dateFilter === 'all') return true;
    if (!dateInput) return false;
    
    const date = new Date(dateInput);
    const now = new Date();
    
    if (dateFilter === 'this_month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    
    if (dateFilter === 'last_month') {
      const lastMonth = new Date();
      lastMonth.setMonth(now.getMonth() - 1);
      return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    }
    
    if (dateFilter === 'custom') {
      if (!customStart || !customEnd) return true;
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }
    
    return true;
  };

  const filteredInvoices = useMemo(() => invoices?.filter(inv => isWithinFilter(inv.createdAt)) || [], [invoices, dateFilter, customStart, customEnd]);
  const filteredLaundryOrders = useMemo(() => laundryOrders?.filter(order => isWithinFilter(order.createdAt)) || [], [laundryOrders, dateFilter, customStart, customEnd]);
  const filteredExpenses = useMemo(() => expenses?.filter(exp => isWithinFilter(exp.date)) || [], [expenses, dateFilter, customStart, customEnd]);

  // Derived Statistics
  const invoiceRevenue = filteredInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
  const laundryRevenue = filteredLaundryOrders.reduce((acc, order) => acc + (order.hotelTotal || 0), 0);
  const totalRevenue = invoiceRevenue + laundryRevenue;
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const ayurAccounts = useMemo(() => {
    return filteredInvoices.filter(inv => inv.isCycleInvoice || inv.invoiceNumber?.startsWith('AYUR')) || [];
  }, [filteredInvoices]);

  const chartData = useMemo(() => {
    return [
      { name: 'Revenue', amount: totalRevenue },
      { name: 'Expenses', amount: totalExpenses },
      { name: 'Net Profit', amount: netProfit },
    ];
  }, [totalRevenue, totalExpenses, netProfit]);

  const sourceData = useMemo(() => {
    const sources: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      const source = inv.bookingSource || 'Unknown';
      sources[source] = (sources[source] || 0) + (inv.totalAmount || 0);
    });
    if (laundryRevenue > 0) {
      sources['Laundry'] = laundryRevenue;
    }
    return Object.entries(sources).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices, laundryRevenue]);

  const handleUpdateGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gstRef || !isAdmin) return;
    
    const updateData = {
      ...gstForm,
      roomGstRate: parseFloat(gstForm.roomGstRate),
      roomCgstRate: parseFloat(gstForm.roomCgstRate),
      roomSgstRate: parseFloat(gstForm.roomSgstRate),
      serviceGstRate: parseFloat(gstForm.serviceGstRate),
      serviceCgstRate: parseFloat(gstForm.serviceCgstRate),
      serviceSgstRate: parseFloat(gstForm.serviceSgstRate),
      entityId,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(gstRef, updateData, { merge: true });
      toast({ title: "Tax settings updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-6 max-w-6xl mx-auto overflow-hidden">
        {/* Highlighted Sidebar */}
        <aside className="w-64 bg-white rounded-3xl border shadow-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 bg-primary text-primary-foreground">
            <h2 className="text-sm font-black uppercase tracking-widest">Accounting</h2>
            <p className="text-[10px] text-primary-foreground/70 font-bold uppercase">FOLIO & REVENUE</p>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1 mt-2">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group",
                    activeView === item.id 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-secondary hover:text-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-4 h-4", activeView === item.id ? "text-white" : "group-hover:text-primary")} />
                    <span className="text-[11px] font-bold">{item.label}</span>
                  </div>
                  {activeView === item.id && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 bg-secondary/30 border-t">
            <div className="p-3 bg-white rounded-2xl border flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black uppercase text-muted-foreground">Live Audit Active</span>
            </div>
          </div>
        </aside>

        {/* View Content */}
        <main className="flex-1 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
          {/* Highlighted Global Filter Bar */}
          <div className="px-8 py-4 border-b bg-primary text-primary-foreground flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Global Date Filter</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-8 w-32 text-[10px] font-bold bg-white text-primary rounded-xl shadow-sm border-none">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-[10px] font-bold">Full History</SelectItem>
                  <SelectItem value="this_month" className="text-[10px] font-bold">This Month</SelectItem>
                  <SelectItem value="last_month" className="text-[10px] font-bold">Last Month</SelectItem>
                  <SelectItem value="custom" className="text-[10px] font-bold">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-8 text-[9px] font-bold bg-white text-primary border-none rounded-xl", !customStart && "text-primary/50")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {customStart ? format(customStart, "PPP") : "Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl">
                      <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <span className="text-[9px] font-black text-white/70">TO</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-8 text-[9px] font-bold bg-white text-primary border-none rounded-xl", !customEnd && "text-primary/50")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {customEnd ? format(customEnd, "PPP") : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl">
                      <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white hover:bg-white/10 rounded-xl"
                onClick={() => { setDateFilter('all'); setCustomStart(undefined); setCustomEnd(undefined); }}
              >
                <FilterX className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-8 space-y-8">
              {activeView === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Financial Overview</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      Health summary for: {dateFilter === 'all' ? 'All Time' : dateFilter.replace('_', ' ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-2 shadow-sm">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-emerald-600/70">Gross Revenue</p>
                        <h3 className="text-2xl font-black text-emerald-700">₹{totalRevenue.toLocaleString()}</h3>
                      </div>
                    </div>
                    <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 space-y-2 shadow-sm">
                      <TrendingDown className="w-6 h-6 text-rose-600" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-rose-600/70">Total Expenses</p>
                        <h3 className="text-2xl font-black text-rose-700">₹{totalExpenses.toLocaleString()}</h3>
                      </div>
                    </div>
                    <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-2 shadow-sm">
                      <LayoutDashboard className="w-6 h-6 text-primary" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-primary/70">Net Operating Profit</p>
                        <h3 className="text-2xl font-black text-primary">₹{netProfit.toLocaleString()}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-6 bg-white rounded-3xl border shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Revenue Mix</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold">Sales (GST Invoices)</span>
                          <span className="text-[11px] font-black">₹{invoiceRevenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${(invoiceRevenue / (totalRevenue || 1)) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[11px] font-bold">Guest Laundry</span>
                          <span className="text-[11px] font-black text-emerald-600">₹{laundryRevenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${(laundryRevenue / (totalRevenue || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'invoices' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-end">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Sales Ledger</h1>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">All processed GST invoices for selected period</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-primary">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-[10px] font-black uppercase pl-6 h-12 text-primary-foreground">Invoice #</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Guest</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Status</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase pr-6 h-12 text-primary-foreground">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : filteredInvoices.length ? (
                          filteredInvoices.map((inv) => (
                            <TableRow key={inv.id} className="group hover:bg-primary/5 transition-colors">
                              <TableCell className="pl-6 font-mono text-[11px] font-bold text-primary">{inv.invoiceNumber}</TableCell>
                              <TableCell className="text-[11px] font-bold">{inv.guestDetails?.name || inv.guestName}</TableCell>
                              <TableCell className="font-black text-[11px]">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={cn("text-[9px] uppercase font-black px-2 h-5", inv.status === "paid" ? "bg-emerald-500" : "bg-rose-500")}>
                                  {inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedInvoice(inv)}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-[10px] text-muted-foreground uppercase font-black">No sales records found for this period</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeView === 'laundry_revenue' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Laundry Revenue Hub</h1>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Detail tracking of guest service income</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center gap-4">
                      <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
                        <WashingMachine className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-indigo-600/70">Filtered Laundry Billed</p>
                        <h3 className="text-xl font-black text-indigo-700">₹{laundryRevenue.toLocaleString()}</h3>
                      </div>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-4">
                      <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                        <Wallet className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-emerald-600/70">Filtered Collected Revenue</p>
                        <h3 className="text-xl font-black text-emerald-700">
                          ₹{filteredLaundryOrders.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.hotelTotal || 0), 0).toLocaleString()}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-primary">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-[10px] font-black uppercase pl-6 h-12 text-primary-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Room & Guest</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Items</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Total ₹</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase pr-6 h-12 text-primary-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {laundryLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : filteredLaundryOrders.length ? (
                          filteredLaundryOrders.map((order) => (
                            <TableRow key={order.id} className="hover:bg-primary/5 transition-colors">
                              <TableCell className="pl-6 text-[11px] font-bold">{formatAppDate(order.createdAt)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black uppercase">Room {order.roomNumber}</span>
                                  <span className="text-[9px] text-muted-foreground font-bold">{order.guestName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[10px] font-medium max-w-[200px] truncate">
                                  {order.items?.map((i: any) => `${i.quantity}x ${i.itemName}`).join(", ")}
                                </div>
                              </TableCell>
                              <TableCell className="font-black text-[11px] text-primary">₹{order.hotelTotal?.toLocaleString()}</TableCell>
                              <TableCell className="text-right pr-6">
                                <Badge className={cn(
                                  "text-[9px] uppercase font-black px-2 h-5",
                                  order.status === "paid" ? "bg-emerald-500" : "bg-amber-500"
                                )}>
                                  {order.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-[10px] text-muted-foreground uppercase font-black">No laundry records found for this period</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeView === 'ayuraccounts' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="bg-primary p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                        <Hospital className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Ayursiha Hospital Accounts</h1>
                        <p className="text-xs text-white/70 font-bold uppercase tracking-widest">Consolidated 10-Day Cycle Reconciliation</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {ayurAccounts.length > 0 ? (
                      ayurAccounts.map((cycle) => (
                        <div key={cycle.id} className="p-6 bg-white rounded-[2rem] border shadow-sm flex items-center justify-between group hover:border-primary transition-all">
                          <div className="flex items-center gap-6">
                            <div className="text-center w-16">
                              <p className="text-[10px] font-black text-muted-foreground uppercase">Cycle</p>
                              <p className="text-lg font-black text-primary">{cycle.invoiceNumber.split('-')[1] || "CYC"}</p>
                            </div>
                            <div className="h-12 w-px bg-border" />
                            <div>
                              <p className="text-sm font-black">{cycle.guestName || "Ayursiha Hospital"}</p>
                              <p className="text-[11px] text-muted-foreground font-bold">{formatAppDate(cycle.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Status</p>
                              <Badge className={cn("text-[9px] font-black px-2 h-5 uppercase", cycle.status === 'paid' ? "bg-emerald-500" : "bg-rose-500")}>
                                {cycle.status}
                              </Badge>
                            </div>
                            <div className="text-right w-32">
                              <p className="text-[10px] font-black text-muted-foreground uppercase">Cycle Total</p>
                              <p className="text-xl font-black text-primary">₹{cycle.totalAmount?.toLocaleString()}</p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-10 w-10 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedInvoice(cycle)}>
                              <ArrowRight className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-24 border-2 border-dashed rounded-[3rem] text-muted-foreground font-black uppercase text-xs">
                        No Ayursiha accounts records found for this period.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeView === 'expenses' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Expense Ledger</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Property operating costs for selected period</p>
                  </div>

                  <div className="rounded-2xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-primary">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-[10px] font-black uppercase pl-6 h-12 text-primary-foreground">Description</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Category</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase h-12 text-right pr-6 text-primary-foreground">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expLoading ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : filteredExpenses.length ? (
                          filteredExpenses.map((exp) => (
                            <TableRow key={exp.id} className="hover:bg-rose-50/30 transition-colors">
                              <TableCell className="pl-6 text-[11px] font-bold">{exp.description}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase px-2 h-5 bg-secondary/50">{exp.category}</Badge></TableCell>
                              <TableCell className="text-[11px] font-bold text-muted-foreground">{formatAppDate(exp.date)}</TableCell>
                              <TableCell className="text-right pr-6">
                                <span className="text-[11px] font-black text-rose-600">₹{exp.amount?.toLocaleString()}</span>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={4} className="text-center py-20 text-[10px] text-muted-foreground uppercase font-black">No expense records found for this period</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeView === 'reports' && isAdmin && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Analytics Reports</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Financial Performance Visualization</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="p-6 bg-white rounded-3xl border shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Gross Revenue vs Expenses</h3>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: '#f1f5f9' }}
                            />
                            <Bar dataKey="amount" fill="#5F5FA7" radius={[10, 10, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-6 bg-white rounded-3xl border shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Revenue by Stream</h3>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={sourceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {sourceData.map((entry, index) => (
                                <ReCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4">
                        {sourceData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-[10px] font-bold uppercase">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'settings' && isAdmin && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Tax & SAC Settings</h1>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Configure Billing Compliance</p>
                  </div>

                  <div className="p-8 bg-white rounded-3xl border shadow-sm max-w-2xl">
                    <form onSubmit={handleUpdateGst} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GSTIN Number</Label>
                          <Input className="h-11 rounded-2xl border-primary/10 bg-secondary/30 text-xs font-bold" placeholder="Enter GSTIN" value={gstForm.gstin} onChange={e => setGstForm({...gstForm, gstin: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SAC Code (Accommodation)</Label>
                          <Input className="h-11 rounded-2xl border-primary/10 bg-secondary/30 text-xs font-bold" placeholder="9963" value={gstForm.sacCode} onChange={e => setGstForm({...gstForm, sacCode: e.target.value})} />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Percent className="w-4 h-4" /> Room Rent GST (Typical: 5%)
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">Total Rate (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-primary/5 text-xs" value={gstForm.roomGstRate} onChange={e => setGstForm({...gstForm, roomGstRate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">CGST (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-primary/5 text-xs" value={gstForm.roomCgstRate} onChange={e => setGstForm({...gstForm, roomCgstRate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">SGST (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-primary/5 text-xs" value={gstForm.roomSgstRate} onChange={e => setGstForm({...gstForm, roomSgstRate: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                            <Percent className="w-4 h-4" /> Service / Extra GST (Typical: 18%)
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">Total Rate (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-emerald-100 text-xs" value={gstForm.serviceGstRate} onChange={e => setGstForm({...gstForm, serviceGstRate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">CGST (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-emerald-100 text-xs" value={gstForm.serviceCgstRate} onChange={e => setGstForm({...gstForm, serviceCgstRate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">SGST (%)</Label>
                              <Input type="number" step="0.01" className="h-10 rounded-xl bg-white border-emerald-100 text-xs" value={gstForm.serviceSgstRate} onChange={e => setGstForm({...gstForm, serviceSgstRate: e.target.value})} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-12 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-xs">
                        <Save className="w-4 h-4 mr-2" /> Commit Tax Configuration
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {((activeView === 'reports' || activeView === 'settings') && !isAdmin) && (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                  <div className="p-6 bg-secondary/50 rounded-full">
                    <Settings2 className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase text-primary">Module Restricted</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Only authorized personnel can access these settings.</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>

        {/* Invoice Detail Dialog */}
        <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem]">
            <div className="p-10 space-y-8 bg-white" id="printable-invoice">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-primary">{property?.name || "SUKHA RETREATS"}</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground max-w-[240px] font-bold uppercase leading-relaxed tracking-wider">
                    {property?.address || "Address details on file"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Tax Invoice</h3>
                  <p className="text-[11px] font-black font-mono">{selectedInvoice?.invoiceNumber}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase">{formatAppDate(selectedInvoice?.createdAt)}</p>
                </div>
              </div>

              <Separator className="bg-primary/10" />

              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Billed To</p>
                  <p className="font-black text-sm text-primary uppercase">{selectedInvoice?.guestName || selectedInvoice?.guestDetails?.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">Room #{selectedInvoice?.roomNumber || selectedInvoice?.stayDetails?.roomNumber || "Cycle"}</p>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Reference Info</p>
                  <p className="font-black text-[10px] uppercase">Entity: {property?.name}</p>
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Settlement: {selectedInvoice?.status}</p>
                </div>
              </div>

              <div className="rounded-2xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-primary">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest pl-4 text-primary-foreground">Description</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest pr-4 text-primary-foreground">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice?.items ? (
                      selectedInvoice.items.map((item: any, idx: number) => (
                        <TableRow key={idx} className="h-12 border-b border-primary/5">
                          <TableCell className="text-[11px] font-bold pl-4 uppercase">{item.name || item.description}</TableCell>
                          <TableCell className="text-right text-[11px] font-black pr-4">₹{item.amount?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="h-12 border-b border-primary/5">
                        <TableCell className="text-[11px] font-bold pl-4 uppercase">Professional Accommodation Services</TableCell>
                        <TableCell className="text-right text-[11px] font-black pr-4">₹{selectedInvoice?.totalAmount?.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-56 space-y-3">
                  <div className="flex justify-between items-center text-[12px] font-black">
                    <span className="text-muted-foreground uppercase tracking-widest">Grand Total</span>
                    <span className="text-primary text-xl">₹{selectedInvoice?.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t-2 border-primary/10">
                    <p className="text-[8px] text-muted-foreground uppercase text-right leading-relaxed font-black tracking-widest">
                      Note: This is a computer-generated document. No signature is required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-secondary/30 border-t flex justify-between gap-4 no-print">
               <Button variant="ghost" className="text-[10px] font-black uppercase" onClick={() => setSelectedInvoice(null)}>Close</Button>
               <Button className="h-11 px-8 font-black text-[10px] uppercase shadow-xl tracking-widest" onClick={handlePrint}>
                 <Printer className="w-4 h-4 mr-2" />
                 Print / Download PDF
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

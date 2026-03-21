"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bed,
  ShieldCheck,
  AlertTriangle,
  Brush,
  LayoutGrid,
  Activity,
  IndianRupee,
  Plus,
  CheckCircle2,
  MessageSquare,
  Loader2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ChevronRight,
  History,
  Building2,
  DoorOpen,
  ArrowRight
} from "lucide-react";

import { cn, formatAppTime, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ------------------------------ */
/* Dashboard Content Component    */
/* ------------------------------ */

const STATUS_CONFIG: any = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Vacant Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning Vacant" },
  occupied: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied Clean" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Vacant Dirty" },
  occupied_dirty: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied Dirty" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
};

function DashboardContent() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const router = useRouter();
  
  const [detailView, setDetailView] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState<string>("");

  useEffect(() => {
    // Set date after hydration to avoid SSR mismatch
    setTodayStr(new Date().toISOString().split('T')[0]);
  }, []);

  /* ------------------------------ */
  /* Firestore Queries              */
  /* ------------------------------ */

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber"));
  }, [db, entityId]);

  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);

  const activeResQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "reservations"),
      where("status", "==", "checked_in")
    );
  }, [db, entityId]);

  const { data: checkedInReservations } = useCollection(activeResQuery);

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "invoices");
  }, [db, entityId]);

  const { data: invoices } = useCollection(invoiceQuery);

  const logsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "whatsapp_logs"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
  }, [db, entityId]);

  const { data: recentLogs } = useCollection(logsQuery);

  /* ------------------------------ */
  /* Stats Aggregation              */
  /* ------------------------------ */

  const stats = useMemo(() => {
    if (!todayStr) return { 
      total: 0, occupied: 0, vacantReady: 0, dirty: 0, cleaning: 0, 
      todayInvoices: [], revenue: 0 
    };

    return {
      total: rooms?.length || 0,
      occupied: rooms?.filter(r => r.status.includes('occupied')).length || 0,
      vacantReady: rooms?.filter(r => r.status === 'available').length || 0,
      dirty: rooms?.filter(r => r.status === 'dirty' || r.status === 'occupied_dirty').length || 0,
      cleaning: rooms?.filter(r => r.status.includes('cleaning')).length || 0,
      todayInvoices: invoices?.filter(inv => inv.createdAt?.startsWith(todayStr)) || [],
      revenue: invoices?.reduce((acc, inv) => {
        const isToday = inv.createdAt?.startsWith(todayStr);
        return isToday ? acc + (inv.totalAmount || 0) : acc;
      }, 0) || 0
    };
  }, [rooms, invoices, todayStr]);

  if (roomsLoading || !todayStr) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Executive Dashboard</h1>
          <p className="text-muted-foreground text-[11px] mt-1 uppercase font-black tracking-[0.2em]">Real-time Operational Intelligence</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push('/reservations')} className="h-11 px-6 font-black uppercase text-[11px] tracking-widest shadow-xl rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> New Reservation
          </Button>
          <Button variant="outline" onClick={() => router.push('/housekeeping')} className="h-11 px-6 font-black uppercase text-[11px] tracking-widest rounded-xl bg-white">
            <Brush className="w-4 h-4 mr-2" /> Cleaning Board
          </Button>
          <div className="flex items-center gap-2 px-4 h-11 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-[11px] font-black uppercase">System Live</span>
          </div>
        </div>
      </div>

      {/* MAIN KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          label="Rooms Occupied" 
          value={stats.occupied} 
          sub={`${stats.total ? Math.round((stats.occupied/stats.total)*100) : 0}% Occupancy`} 
          icon={Bed} 
          color="text-blue-600" 
          bg="bg-blue-50" 
          onClick={() => setDetailView('occupied')}
        />
        <KPICard 
          label="Vacant Ready" 
          value={stats.vacantReady} 
          sub="Immediate Availability" 
          icon={ShieldCheck} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
          onClick={() => setDetailView('vacant')}
        />
        <KPICard 
          label="Today's Revenue" 
          value={`₹${stats.revenue.toLocaleString()}`} 
          sub="Current Settlements" 
          icon={IndianRupee} 
          color="text-primary" 
          bg="bg-primary/5" 
          onClick={() => setDetailView('revenue')}
        />
        <KPICard 
          label="Dirty Units" 
          value={stats.dirty} 
          sub="Housekeeping Required" 
          icon={AlertTriangle} 
          color="text-orange-600" 
          bg="bg-orange-50" 
          onClick={() => setDetailView('dirty')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ROOM STATUS BOARD */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Room Status Board
            </h3>
            <Badge variant="outline" className="text-[10px] font-black uppercase bg-white">{stats.total} Total Units</Badge>
          </div>
          
          <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-4">
              {rooms?.map((room) => {
                const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
                return (
                  <div 
                    key={room.id} 
                    onClick={() => router.push('/housekeeping')}
                    className="group cursor-pointer space-y-2"
                  >
                    <div className={cn(
                      "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all group-hover:scale-105 shadow-sm",
                      room.status === 'available' ? "bg-emerald-50 border-emerald-100" : 
                      room.status.includes('occupied') ? "bg-blue-50 border-blue-100" :
                      "bg-orange-50 border-orange-100"
                    )}>
                      <span className={cn("text-lg font-black", config.color)}>{room.roomNumber}</span>
                      <config.icon className={cn("w-4 h-4 mt-1", config.color)} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-center text-muted-foreground truncate px-1">
                      {config.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SIDEBAR: ACTIVITY & ALERTS */}
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> WhatsApp Activity
            </h3>
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden divide-y">
              {recentLogs?.map((log) => (
                <div key={log.id} className="p-4 hover:bg-secondary/10 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-black text-primary uppercase">{log.direction}</span>
                    <span className="text-[9px] font-bold text-muted-foreground">{formatAppTime(log.createdAt)}</span>
                  </div>
                  <p className="text-[12px] font-medium leading-relaxed line-clamp-2 text-slate-700 italic">
                    "{log.message}"
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1.5 uppercase tracking-tighter">
                    {log.phoneNumber} • {log.role}
                  </p>
                </div>
              ))}
              {(!recentLogs || recentLogs.length === 0) && (
                <div className="p-10 text-center text-[11px] text-muted-foreground font-black uppercase">No recent traffic</div>
              )}
            </div>
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-primary hover:bg-primary/5" onClick={() => router.push('/communications')}>
              View Full Transmission Log
            </Button>
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" /> Property Health
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white rounded-2xl border shadow-sm">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Cleaning In-Progress</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-primary">{stats.cleaning}</span>
                  <Brush className="w-4 h-4 text-primary mb-1" />
                </div>
              </div>
              <div className="p-4 bg-white rounded-2xl border shadow-sm">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Guest Check-ins</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-blue-600">{checkedInReservations?.length || 0}</span>
                  <Bed className="w-4 h-4 text-blue-600 mb-1" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* DRILL DOWN DIALOGS */}
      <Dialog open={!!detailView} onOpenChange={(o) => !o && setDetailView(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2.5rem]">
          <div className={cn(
            "p-8 text-white space-y-2",
            detailView === 'occupied' ? "bg-blue-600" :
            detailView === 'vacant' ? "bg-emerald-600" :
            detailView === 'revenue' ? "bg-primary" :
            "bg-orange-600"
          )}>
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
              {detailView === 'occupied' && <Bed className="w-7 h-7" />}
              {detailView === 'vacant' && <ShieldCheck className="w-7 h-7" />}
              {detailView === 'revenue' && <IndianRupee className="w-7 h-7" />}
              {detailView === 'dirty' && <AlertTriangle className="w-7 h-7" />}
              {detailView?.replace(/^\w/, (c) => c.toUpperCase())} Units Detail
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold uppercase text-[10px] tracking-widest">
              Factual operational audit for {formatAppDate(new Date().toISOString())}
            </DialogDescription>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="p-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase">Room</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">
                      {detailView === 'revenue' ? 'Guest / Invoice' : 'Guest Name'}
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">
                      {detailView === 'revenue' ? 'Amount' : 'Status'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailView === 'occupied' && (
                    rooms?.filter(r => r.status.includes('occupied')).map(room => {
                      const res = checkedInReservations?.find(res => res.roomNumber?.toString() === room.roomNumber?.toString());
                      return (
                        <TableRow key={room.id}>
                          <TableCell className="font-black text-blue-600">{room.roomNumber}</TableCell>
                          <TableCell className="font-bold text-[11px] uppercase">{res?.guestName || "Processing..."}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black uppercase">In-House</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}

                  {detailView === 'vacant' && (
                    rooms?.filter(r => r.status === 'available').map(room => (
                      <TableRow key={room.id}>
                        <TableCell className="font-black text-emerald-600">{room.roomNumber}</TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">Floor {room.floor}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-50 text-emerald-600 border-blue-100 text-[8px] font-black uppercase">Ready</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  {detailView === 'dirty' && (
                    rooms?.filter(r => r.status === 'dirty' || r.status === 'occupied_dirty').map(room => (
                      <TableRow key={room.id}>
                        <TableCell className="font-black text-orange-600">{room.roomNumber}</TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                          {room.status === 'dirty' ? 'Vacant - Requires Service' : 'Occupied - Requires Service'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase">Priority</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  {detailView === 'revenue' && (
                    stats.todayInvoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-black text-primary">{inv.roomNumber || inv.stayDetails?.roomNumber || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-[11px] uppercase">{inv.guestDetails?.name || inv.guestName}</span>
                            <span className="text-[8px] font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-primary">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}

                  {((detailView === 'revenue' && stats.todayInvoices.length === 0) || 
                    (detailView === 'occupied' && rooms?.filter(r => r.status.includes('occupied')).length === 0) ||
                    (detailView === 'dirty' && rooms?.filter(r => r.status.includes('dirty')).length === 0)) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-[10px] font-black uppercase text-muted-foreground">
                        No active records for this category today
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          
          <div className="p-6 bg-secondary/20 border-t flex justify-between items-center">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <History className="w-3 h-3" /> Live Audit Log
            </p>
            <Button variant="ghost" className="text-[10px] font-black uppercase text-primary" onClick={() => setDetailView(null)}>
              Close Audit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, color, bg, onClick }: any) {
  return (
    <Card 
      className={cn(
        "border-none shadow-sm overflow-hidden bg-white rounded-[2rem] cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] group",
        onClick && "active:scale-95"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 flex items-center gap-5 relative">
        <div className={cn("p-4 rounded-2xl shrink-0 shadow-inner", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
          <h3 className="text-2xl font-black mt-0.5 tracking-tight">{value}</h3>
          <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-70">{sub}</p>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className={cn("w-4 h-4", color)} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ */
/* Dashboard Page Export           */
/* ------------------------------ */

export default function DashboardPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </AppLayout>
  );
}

"use client";

import { useState, useMemo, Suspense } from "react";
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
  AlertCircle
} from "lucide-react";

import { cn, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ------------------------------ */
/* Dashboard Content Component    */
/* ------------------------------ */

const STATUS_CONFIG: any = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning" },
  occupied: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Dirty" },
  occupied_dirty: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50", label: "Occ Dirty" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maint" },
};

function DashboardContent() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const router = useRouter();

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

  const stats = useMemo(() => ({
    total: rooms?.length || 0,
    occupied: rooms?.filter(r => r.status.includes('occupied')).length || 0,
    vacantReady: rooms?.filter(r => r.status === 'available').length || 0,
    dirty: rooms?.filter(r => r.status === 'dirty' || r.status === 'occupied_dirty').length || 0,
    cleaning: rooms?.filter(r => r.status.includes('cleaning')).length || 0,
    revenue: invoices?.reduce((acc, inv) => {
      const isToday = inv.createdAt?.startsWith(new Date().toISOString().split('T')[0]);
      return isToday ? acc + (inv.totalAmount || 0) : acc;
    }, 0) || 0
  }), [rooms, invoices]);

  if (roomsLoading) {
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
          <p className="text-muted-foreground text-[10px] mt-1 uppercase font-black tracking-[0.2em]">Real-time Operational Intelligence</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push('/reservations')} className="h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> New Reservation
          </Button>
          <Button variant="outline" onClick={() => router.push('/housekeeping')} className="h-11 px-6 font-black uppercase text-[10px] tracking-widest rounded-xl bg-white">
            <Brush className="w-4 h-4 mr-2" /> Cleaning Board
          </Button>
          <div className="flex items-center gap-2 px-4 h-11 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-[10px] font-black uppercase">System Live</span>
          </div>
        </div>
      </div>

      {/* MAIN KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Rooms Occupied" value={stats.occupied} sub={`${stats.total ? Math.round((stats.occupied/stats.total)*100) : 0}% Occupancy`} icon={Bed} color="text-blue-600" bg="bg-blue-50" />
        <KPICard label="Vacant Ready" value={stats.vacantReady} sub="Immediate Availability" icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
        <KPICard label="Today's Revenue" value={`₹${stats.revenue.toLocaleString()}`} sub="Current Settlements" icon={IndianRupee} color="text-primary" bg="bg-primary/5" />
        <KPICard label="Dirty Units" value={stats.dirty} sub="Housekeeping Required" icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ROOM STATUS BOARD */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Room Status Board
            </h3>
            <Badge variant="outline" className="text-[9px] font-black uppercase bg-white">{stats.total} Total Units</Badge>
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
                      <config.icon className={cn("w-3.5 h-3.5 mt-1", config.color)} />
                    </div>
                    <p className="text-[8px] font-black uppercase text-center text-muted-foreground truncate px-1">
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
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> WhatsApp Activity
            </h3>
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden divide-y">
              {recentLogs?.map((log) => (
                <div key={log.id} className="p-4 hover:bg-secondary/10 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black text-primary uppercase">{log.direction}</span>
                    <span className="text-[8px] font-bold text-muted-foreground">{formatAppTime(log.createdAt)}</span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed line-clamp-2 text-slate-700 italic">
                    "{log.message}"
                  </p>
                  <p className="text-[9px] font-bold text-muted-foreground mt-1.5 uppercase tracking-tighter">
                    {log.phoneNumber} • {log.role}
                  </p>
                </div>
              ))}
              {(!recentLogs || recentLogs.length === 0) && (
                <div className="p-10 text-center text-[10px] text-muted-foreground font-black uppercase">No recent traffic</div>
              )}
            </div>
            <Button variant="ghost" className="w-full text-[9px] font-black uppercase text-primary hover:bg-primary/5" onClick={() => router.push('/communications')}>
              View Full Transmission Log
            </Button>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" /> Property Health
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white rounded-2xl border shadow-sm">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Cleaning In-Progress</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-primary">{stats.cleaning}</span>
                  <Brush className="w-4 h-4 text-primary mb-1" />
                </div>
              </div>
              <div className="p-4 bg-white rounded-2xl border shadow-sm">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Guest Check-ins</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-blue-600">{checkedInReservations?.length || 0}</span>
                  <Bed className="w-4 h-4 text-blue-600 mb-1" />
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2rem]">
      <CardContent className="p-6 flex items-center gap-5">
        <div className={cn("p-4 rounded-2xl shrink-0 shadow-inner", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        <div>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
          <h3 className="text-2xl font-black mt-0.5 tracking-tight">{value}</h3>
          <p className="text-[9px] font-bold text-muted-foreground mt-1 opacity-70">{sub}</p>
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

"use client";

import { useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { 
  Building2, 
  Users, 
  BedDouble, 
  Wrench, 
  WashingMachine, 
  TrendingUp, 
  AlertCircle,
  Activity,
  ShieldCheck,
  Brush,
  AlertTriangle,
  History,
  Info,
  Monitor
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays } from "date-fns";

/**
 * EntityCommandPanel - Renders a side-by-side operational overview for a property.
 */
function EntityCommandPanel({ entity, db }: { entity: any; db: any }) {
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    // Set date after hydration to avoid SSR mismatch
    setToday(new Date().toISOString().split('T')[0]);
  }, []);

  // Real-time Data Listeners for the specific entity
  const roomsRef = useMemoFirebase(() => collection(db, "hotel_properties", entity.id, "rooms"), [entity.id]);
  const tasksRef = useMemoFirebase(() => collection(db, "hotel_properties", entity.id, "housekeeping_tasks"), [entity.id]);
  const laundryRef = useMemoFirebase(() => collection(db, "hotel_properties", entity.id, "guest_laundry_orders"), [entity.id]);
  const invoicesRef = useMemoFirebase(() => collection(db, "hotel_properties", entity.id, "invoices"), [entity.id]);
  const reservationsRef = useMemoFirebase(() => collection(db, "hotel_properties", entity.id, "reservations"), [entity.id]);

  const { data: rooms } = useCollection(roomsRef);
  const { data: tasks } = useCollection(tasksRef);
  const { data: laundry } = useCollection(laundryRef);
  const { data: invoices } = useCollection(invoicesRef);
  const { data: reservations } = useCollection(reservationsRef);

  // Stats Aggregation
  const stats = useMemo(() => {
    const referenceDate = today || new Date().toISOString().split('T')[0];
    const monthStart = referenceDate.substring(0, 7);

    // Occupancy
    const totalRooms = rooms?.length || 0;
    const occupied = rooms?.filter(r => r.status.includes('occupied')).length || 0;
    const vacant = totalRooms - occupied;

    // Housekeeping
    const clean = rooms?.filter(r => r.status === 'available' || r.status === 'occupied').length || 0;
    const dirty = rooms?.filter(r => r.status === 'dirty' || r.status === 'occupied_dirty').length || 0;
    const cleaning = rooms?.filter(r => r.status.includes('cleaning')).length || 0;
    const ready = rooms?.filter(r => r.status === 'available').length || 0;

    // Maintenance
    const maintRooms = rooms?.filter(r => r.status === 'maintenance').length || 0;
    const openMaint = tasks?.filter(t => t.taskType === 'repair' && t.status !== 'completed').length || 0;
    const completedMaintToday = tasks?.filter(t => t.taskType === 'repair' && t.status === 'completed' && t.updatedAt?.startsWith(referenceDate)).length || 0;

    // Laundry
    const laundrySentToday = laundry?.filter(l => l.createdAt?.startsWith(referenceDate)).length || 0;
    const laundryReturnedToday = laundry?.filter(l => l.status === 'returned' && l.updatedAt?.startsWith(referenceDate)).length || 0;
    const laundryPending = laundry?.filter(l => l.status === 'sent').length || 0;

    // Revenue
    const todayRev = invoices?.filter(i => i.createdAt?.startsWith(referenceDate)).reduce((acc, i) => acc + (i.totalAmount || 0), 0) || 0;
    const monthRev = invoices?.filter(i => i.createdAt?.startsWith(monthStart)).reduce((acc, i) => acc + (i.totalAmount || 0), 0) || 0;

    // Ayursiha Specifics
    const ayurRes = reservations?.filter(r => r.status === 'checked_in' && r.bookingSource === 'Ayursiha');
    const ayurRooms = ayurRes?.length || 0;
    // Current cycle revenue (assuming cycle is month or specific Ayur stays)
    const ayurCycleRev = invoices?.filter(i => {
      const res = reservations?.find(r => r.id === i.reservationId);
      return res?.bookingSource === 'Ayursiha' && i.createdAt?.startsWith(monthStart);
    }).reduce((acc, i) => acc + (i.totalAmount || 0), 0) || 0;

    // Alerts
    const alerts = [];
    if (dirty > (totalRooms * 0.3)) alerts.push("High volume of dirty rooms");
    if (openMaint > 3) alerts.push("Maintenance backlog detected");
    
    const overdueLaundry = laundry?.filter(l => {
      if (l.status !== 'sent') return false;
      const sentDate = new Date(l.createdAt);
      const now = new Date();
      return (now.getTime() - sentDate.getTime()) > (24 * 60 * 60 * 1000);
    });
    if (overdueLaundry?.length) alerts.push("Laundry pending > 24 hours");

    return {
      totalRooms, occupied, vacant,
      clean, dirty, cleaning, ready,
      maintRooms, openMaint, completedMaintToday,
      laundrySentToday, laundryReturnedToday, laundryPending,
      todayRev, monthRev,
      ayurRooms, ayurCycleRev,
      alerts
    };
  }, [rooms, tasks, laundry, invoices, reservations, today]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-black uppercase tracking-tighter text-primary">{entity.name}</h2>
      </div>

      {/* Occupancy Grid */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Occupancy Status
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Total Units" value={stats.totalRooms} icon={Building2} />
          <MetricCard label="Occupied" value={stats.occupied} icon={BedDouble} color="text-primary" />
          <MetricCard label="Vacant" value={stats.vacant} icon={ShieldCheck} color="text-emerald-600" />
        </div>
      </section>

      {/* Housekeeping Grid */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
          <Brush className="w-3.5 h-3.5" /> Housekeeping Status
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <MetricCard label="Clean" value={stats.clean} small />
          <MetricCard label="Dirty" value={stats.dirty} color="text-orange-500" small />
          <MetricCard label="In-Process" value={stats.cleaning} color="text-primary" small />
          <MetricCard label="Ready" value={stats.ready} color="text-emerald-500" small />
        </div>
      </section>

      {/* Maintenance & Laundry */}
      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Maintenance
          </h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border shadow-sm">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Open Tasks</span>
              <span className="text-xs font-black">{stats.openMaint}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border shadow-sm">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Fixed Today</span>
              <span className="text-xs font-black text-emerald-600">{stats.completedMaintToday}</span>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <WashingMachine className="w-3.5 h-3.5" /> Laundry Flow
          </h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border shadow-sm">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Sent Today</span>
              <span className="text-xs font-black">{stats.laundrySentToday}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border shadow-sm">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Signature Pending</span>
              <span className="text-xs font-black text-amber-600">{stats.laundryPending}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Revenue Section */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Revenue Metrics
        </h3>
        <Card className="border-none bg-primary/5 shadow-none overflow-hidden">
          <CardContent className="p-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-black uppercase text-primary/60">Today's Sales</p>
              <h4 className="text-sm font-black">₹{stats.todayRev.toLocaleString()}</h4>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-primary/60">Monthly MTD</p>
              <h4 className="text-sm font-black">₹{stats.monthRev.toLocaleString()}</h4>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Ayursiha Metrics */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-rose-500" /> Ayursiha Operations
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
            <p className="text-[9px] font-black uppercase text-rose-600/70">Hospital Occupancy</p>
            <h5 className="text-sm font-black">{stats.ayurRooms} Units</h5>
          </div>
          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-right">
            <p className="text-[9px] font-black uppercase text-rose-600/70">Cycle Revenue</p>
            <h5 className="text-sm font-black">₹{stats.ayurCycleRev.toLocaleString()}</h5>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-rose-600 tracking-widest flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> System Alerts
          </h3>
          <div className="space-y-1">
            {stats.alerts.map((alert, idx) => (
              <div key={idx} className="px-2 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                {alert}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color = "", small = false }: any) {
  return (
    <div className="p-3 bg-white rounded-xl border shadow-sm flex flex-col items-center justify-center text-center">
      {Icon && <Icon className={cn("w-4 h-4 mb-1.5 text-muted-foreground", color)} />}
      <span className={cn("font-black", small ? "text-base" : "text-xl", color)}>{value}</span>
      <span className="text-[9.5px] font-black uppercase text-muted-foreground tracking-tight">{label}</span>
    </div>
  );
}

export default function CommandCenterPage() {
  const { role, availableProperties } = useAuthStore();
  const db = useFirestore();

  const isAuthorized = ["owner", "admin", "manager"].includes(role || "");

  const retreatEntity = availableProperties.find(p => p.name.toLowerCase().includes('retreat'));
  const paradiseEntity = availableProperties.find(p => p.name.toLowerCase().includes('paradise'));

  if (!isAuthorized) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/20" />
          <h2 className="text-xl font-black uppercase tracking-tighter">Access Denied</h2>
          <p className="text-xs text-muted-foreground max-w-xs font-bold uppercase">This module is reserved for Executive Management only.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8" suppressHydrationWarning>
        <header className="flex justify-between items-end border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-primary text-white p-1 rounded">
                <Monitor className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-primary">COMMAND CENTER</h1>
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Consolidated Multi-Property Operations</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-[11px] font-black uppercase">Live Sync Active</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {retreatEntity ? (
            <EntityCommandPanel entity={retreatEntity} db={db} />
          ) : (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-bold uppercase text-[11px]">Sukha Retreats data unavailable</div>
          )}

          {paradiseEntity ? (
            <EntityCommandPanel entity={paradiseEntity} db={db} />
          ) : (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-bold uppercase text-[11px]">Sukha Paradise data unavailable</div>
          )}
        </div>

        <footer className="pt-10 border-t flex justify-center">
          <div className="flex items-center gap-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Automated Sync (Real-time)</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Summarized Operational Context</span>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}

"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Bed, 
  TrendingUp, 
  CalendarCheck2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Brush,
  BarChart3,
  LayoutGrid,
  Activity
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";

export default function DashboardPage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);

  const todayResQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "reservations"),
      where("checkInDate", ">=", startOfDay(new Date()).toISOString()),
      where("checkInDate", "<=", endOfDay(new Date()).toISOString())
    );
  }, [db, entityId]);
  const { data: todayReservations } = useCollection(todayResQuery);

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "invoices");
  }, [db, entityId]);
  const { data: invoices } = useCollection(invoiceQuery);

  const stats = {
    total: rooms?.length || 0,
    vacantReady: rooms?.filter(r => r.status === 'available').length || 0,
    vacantDirty: rooms?.filter(r => r.status === 'dirty').length || 0,
    occupied: rooms?.filter(r => r.status.includes('occupied')).length || 0,
    cleaning: rooms?.filter(r => r.status.includes('cleaning')).length || 0,
  };
  
  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
  
  const todayRevenue = invoices?.reduce((acc, inv) => {
    const isToday = inv.createdAt?.startsWith(new Date().toISOString().split('T')[0]);
    return isToday ? acc + (inv.totalAmount || 0) : acc;
  }, 0) || 0;

  const PRIMARY_STATS = [
    { label: "Total Occupancy", value: `${occupancyRate}%`, icon: Users, change: "Live", trend: "neutral" },
    { label: "Vacant Ready", value: stats.vacantReady.toString(), icon: ShieldCheck, change: "Rooms", trend: "up" },
    { label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString()}`, icon: TrendingUp, change: "+12%", trend: "up" },
    { label: "Today's Arrival", value: (todayReservations?.length || 0).toString(), icon: CalendarCheck2, change: "Confirmed", trend: "neutral" },
  ];

  const SECONDARY_STATS = [
    { label: "Vacant Dirty", value: stats.vacantDirty.toString(), icon: AlertTriangle, color: "text-orange-500" },
    { label: "Cleaning Process", value: stats.cleaning.toString(), icon: Brush, color: "text-primary" },
    { label: "Total Occupied", value: stats.occupied.toString(), icon: Bed, color: "text-blue-500" },
  ];

  const chartData = [
    { name: "Mon", occupancy: 45, revenue: 1200 },
    { name: "Tue", occupancy: 52, revenue: 2100 },
    { name: "Wed", occupancy: 48, revenue: 1800 },
    { name: "Thu", occupancy: 61, revenue: 3200 },
    { name: "Fri", occupancy: occupancyRate || 55, revenue: todayRevenue || 4500 },
  ];

  if (roomsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
            <p className="text-muted-foreground text-xs mt-0.5 uppercase font-bold tracking-wider">Property performance and real-time operations</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 rounded-lg border border-primary/10">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase">System Live</span>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Key Performance Indicators</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {PRIMARY_STATS.map((stat) => (
              <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-secondary rounded-lg">
                      <stat.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className={cn(
                      "flex items-center text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                      stat.trend === "up" ? "bg-emerald-50 text-emerald-600" : stat.trend === "down" ? "bg-rose-50 text-rose-600" : "bg-muted text-muted-foreground"
                    )}>
                      {stat.change}
                      {stat.trend === "up" && <ArrowUpRight className="w-2 h-2 ml-0.5" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    <h3 className="text-lg font-bold mt-0.5">{stat.value}</h3>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room Inventory & Status</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SECONDARY_STATS.map((stat) => (
              <Card key={stat.label} className="border-none shadow-sm">
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-secondary", stat.color)}>
                    <stat.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    <h4 className="text-sm font-bold">{stat.value}</h4>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance Analytics</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-bold uppercase text-muted-foreground">Revenue Growth (7D)</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px] p-4 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-bold uppercase text-muted-foreground">Occupancy Trends (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px] p-4 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} />
                    <Tooltip />
                    <Line type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0}} activeDot={{r: 5}} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

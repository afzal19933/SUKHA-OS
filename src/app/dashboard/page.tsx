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
  Brush
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
  const { entityId, theme } = useAuthStore();
  const db = useFirestore();
  const isAyurveda = theme === 'ayurveda';

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
      <div className="space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-ayurveda-heading">Executive Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[2px] font-medium opacity-70">Summary of property performance and room operations</p>
        </div>

        <div className="gold-separator" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {PRIMARY_STATS.map((stat) => (
            <Card key={stat.label} className={cn(
              "border-none shadow-xl overflow-hidden transition-all hover:-translate-y-1",
              isAyurveda ? "glass-card border-l-4 border-l-primary" : "bg-white"
            )}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("p-2 rounded-xl", isAyurveda ? "bg-primary/20" : "bg-secondary")}>
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className={cn(
                    "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    stat.trend === "up" ? "bg-emerald-500/10 text-emerald-500" : stat.trend === "down" ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
                  )}>
                    {stat.change}
                    {stat.trend === "up" && <ArrowUpRight className="w-3 h-3 ml-0.5" />}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[1.5px]">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-1 font-manrope">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SECONDARY_STATS.map((stat) => (
            <Card key={stat.label} className={cn(
              "border-none shadow-lg transition-all hover:scale-[1.02]",
              isAyurveda ? "glass-card" : "bg-white"
            )}>
              <CardContent className="p-5 flex items-center gap-5">
                <div className={cn("p-3 rounded-2xl bg-secondary/50", stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <h4 className="text-xl font-bold font-manrope">{stat.value}</h4>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className={cn(
            "border-none shadow-xl",
            isAyurveda ? "glass-card" : "bg-white"
          )}>
            <CardHeader className="py-5">
              <CardTitle className="text-base font-ayurveda-heading">Revenue Trends (Luxury KPI)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isAyurveda ? "rgba(255,255,255,0.05)" : "hsl(var(--border))"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: isAyurveda ? '#122F28' : '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', fontSize: '10px'}}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-none shadow-xl",
            isAyurveda ? "glass-card" : "bg-white"
          )}>
            <CardHeader className="py-5">
              <CardTitle className="text-base font-ayurveda-heading">Occupancy Levels (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isAyurveda ? "rgba(255,255,255,0.05)" : "hsl(var(--border))"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: isAyurveda ? '#122F28' : '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', fontSize: '10px'}}
                  />
                  <Line type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
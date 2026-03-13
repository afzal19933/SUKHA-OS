"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Bed, 
  TrendingUp, 
  CalendarCheck2,
  ArrowUpRight,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Brush,
  BarChart3,
  LayoutGrid,
  Activity,
  MapPin,
  User,
  Globe,
  Info
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Core Data Fetching
  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
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

  const todayArrivalsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    const today = new Date().toISOString().split('T')[0];
    return query(
      collection(db, "hotel_properties", entityId, "reservations"),
      where("checkInDate", "==", today),
      where("status", "==", "confirmed")
    );
  }, [db, entityId]);
  const { data: todayArrivals } = useCollection(todayArrivalsQuery);

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "invoices");
  }, [db, entityId]);
  const { data: invoices } = useCollection(invoiceQuery);

  // Statistics Calculation
  const stats = useMemo(() => ({
    total: rooms?.length || 0,
    vacantReady: rooms?.filter(r => r.status === 'available').length || 0,
    vacantDirty: rooms?.filter(r => r.status === 'dirty').length || 0,
    occupied: rooms?.filter(r => r.status.includes('occupied')).length || 0,
    cleaning: rooms?.filter(r => r.status.includes('cleaning')).length || 0,
  }), [rooms]);
  
  const todayRevenue = useMemo(() => invoices?.reduce((acc, inv) => {
    const isToday = inv.createdAt?.startsWith(new Date().toISOString().split('T')[0]);
    return isToday ? acc + (inv.totalAmount || 0) : acc;
  }, 0) || 0, [invoices]);

  const PRIMARY_STATS = [
    { id: "occupied", label: "Rooms Occupied", value: stats.occupied.toString(), icon: Users, change: "Live", trend: "neutral" },
    { id: "vacant_ready", label: "Vacant Ready", value: stats.vacantReady.toString(), icon: ShieldCheck, change: "Rooms", trend: "up" },
    { id: "revenue", label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString()}`, icon: TrendingUp, change: "+12%", trend: "up" },
    { id: "arrivals", label: "Today's Arrival", value: (todayArrivals?.length || 0).toString(), icon: CalendarCheck2, change: "Confirmed", trend: "neutral" },
  ];

  const SECONDARY_STATS = [
    { id: "vacant_dirty", label: "Vacant Dirty", value: stats.vacantDirty.toString(), icon: AlertTriangle, color: "text-orange-500" },
    { id: "cleaning", label: "Cleaning Process", value: stats.cleaning.toString(), icon: Brush, color: "text-primary" },
    { id: "total_occupied", label: "Total Occupied", value: stats.occupied.toString(), icon: Bed, color: "text-blue-500" },
  ];

  const chartData = [
    { name: "Mon", occupancy: 4, revenue: 1200 },
    { name: "Tue", occupancy: 6, revenue: 2100 },
    { name: "Wed", occupancy: 5, revenue: 1800 },
    { name: "Thu", occupancy: 8, revenue: 3200 },
    { name: "Fri", occupancy: stats.occupied || 5, revenue: todayRevenue || 4500 },
  ];

  // Metric Drill-down Content
  const drillDownContent = useMemo(() => {
    if (!selectedMetric) return null;

    switch (selectedMetric) {
      case 'occupied':
      case 'total_occupied':
        return {
          title: "Occupied Rooms",
          description: "Rooms currently with active guests",
          items: rooms?.filter(r => r.status.includes('occupied')).map(r => {
            const res = checkedInReservations?.find(res => res.roomNumber?.toString() === r.roomNumber?.toString());
            return {
              id: r.id,
              primary: `Room ${r.roomNumber}`,
              secondary: res?.guestName || "Guest Details Pending",
              extra: res?.nationality || "Unknown",
              icon: MapPin,
              badge: r.status.replace('_', ' ')
            };
          })
        };
      case 'vacant_ready':
        return {
          title: "Vacant Ready Rooms",
          description: "Rooms clean and available for check-in",
          items: rooms?.filter(r => r.status === 'available').map(r => ({
            id: r.id,
            primary: `Room ${r.roomNumber}`,
            secondary: `Floor ${r.floor}`,
            extra: r.roomTypeId,
            icon: ShieldCheck,
            badge: "Available"
          }))
        };
      case 'vacant_dirty':
        return {
          title: "Vacant Dirty Rooms",
          description: "Rooms requiring immediate housekeeping",
          items: rooms?.filter(r => r.status === 'dirty').map(r => ({
            id: r.id,
            primary: `Room ${r.roomNumber}`,
            secondary: `Floor ${r.floor}`,
            extra: "Requires Cleaning",
            icon: AlertTriangle,
            badge: "Dirty"
          }))
        };
      case 'cleaning':
        return {
          title: "Rooms Under Cleaning",
          description: "Rooms currently being processed by housekeeping",
          items: rooms?.filter(r => r.status.includes('cleaning')).map(r => ({
            id: r.id,
            primary: `Room ${r.roomNumber}`,
            secondary: `Floor ${r.floor}`,
            extra: "Cleaning in progress",
            icon: Brush,
            badge: r.status.replace('_', ' ')
          }))
        };
      case 'arrivals':
        return {
          title: "Today's Arrivals",
          description: "Confirmed bookings expected today",
          items: todayArrivals?.map(res => ({
            id: res.id,
            primary: res.guestName,
            secondary: `Room ${res.roomNumber}`,
            extra: res.bookingSource,
            icon: CalendarCheck2,
            badge: res.status
          }))
        };
      case 'revenue':
        return {
          title: "Today's Invoices",
          description: "Financial transactions processed today",
          items: invoices?.filter(inv => inv.createdAt?.startsWith(new Date().toISOString().split('T')[0])).map(inv => ({
            id: inv.id,
            primary: inv.invoiceNumber,
            secondary: inv.guestName,
            extra: `₹${inv.totalAmount?.toLocaleString()}`,
            icon: TrendingUp,
            badge: inv.status
          }))
        };
      default:
        return null;
    }
  }, [selectedMetric, rooms, checkedInReservations, todayArrivals, invoices]);

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
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property Performance KPIs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {PRIMARY_STATS.map((stat) => (
              <Card 
                key={stat.id} 
                className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedMetric(stat.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
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
              <Card 
                key={stat.id} 
                className="border-none shadow-sm cursor-pointer group hover:bg-secondary/30 transition-all"
                onClick={() => setSelectedMetric(stat.id)}
              >
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-secondary transition-colors", stat.color)}>
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
                <CardTitle className="text-[11px] font-bold uppercase text-muted-foreground">Occupancy Trends (Rooms)</CardTitle>
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

        {/* Drill-down Detail Dialog */}
        <Dialog open={!!selectedMetric} onOpenChange={(open) => !open && setSelectedMetric(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                {drillDownContent?.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {drillDownContent?.description}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="mt-4 h-[350px] pr-4">
              <div className="space-y-2.5">
                {drillDownContent?.items && drillDownContent.items.length > 0 ? (
                  drillDownContent.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg">
                          <item.icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{item.primary}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {selectedMetric === 'occupied' || selectedMetric === 'total_occupied' ? <User className="w-2.5 h-2.5" /> : null}
                              {item.secondary}
                            </span>
                            {item.extra && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 border-l pl-2">
                                {selectedMetric === 'occupied' || selectedMetric === 'total_occupied' ? <Globe className="w-2.5 h-2.5" /> : null}
                                {item.extra}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] uppercase font-bold tracking-tight h-4 px-1.5">
                        {item.badge}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xs text-muted-foreground font-bold uppercase">No records found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

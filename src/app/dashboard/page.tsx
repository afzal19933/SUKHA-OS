
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
  Loader2
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

  // Fetch Rooms for Occupancy
  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);

  // Fetch Today's Reservations
  const todayResQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "reservations"),
      where("checkInDate", ">=", startOfDay(new Date()).toISOString()),
      where("checkInDate", "<=", endOfDay(new Date()).toISOString())
    );
  }, [db, entityId]);
  const { data: todayReservations } = useCollection(todayResQuery);

  // Fetch Invoices for Revenue
  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "invoices");
  }, [db, entityId]);
  const { data: invoices } = useCollection(invoiceQuery);

  const totalRooms = rooms?.length || 0;
  const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  
  const todayRevenue = invoices?.reduce((acc, inv) => {
    const isToday = inv.createdAt?.startsWith(new Date().toISOString().split('T')[0]);
    return isToday ? acc + (inv.totalAmount || 0) : acc;
  }, 0) || 0;

  const STATS = [
    { label: "Total Occupancy", value: `${occupancyRate}%`, icon: Users, change: "Live", trend: "neutral" },
    { label: "Available Rooms", value: (totalRooms - occupiedRooms).toString(), icon: Bed, change: "Rooms", trend: "neutral" },
    { label: "Today's Revenue", value: `$${todayRevenue.toLocaleString()}`, icon: TrendingUp, change: "+0%", trend: "up" },
    { label: "Expected Check-ins", value: (todayReservations?.length || 0).toString(), icon: CalendarCheck2, change: "Today", trend: "neutral" },
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
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time performance for your property.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => (
            <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-1.5 bg-secondary rounded-lg">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className={cn(
                    "flex items-center text-xs font-medium",
                    stat.trend === "up" ? "text-emerald-500" : stat.trend === "down" ? "text-rose-500" : "text-muted-foreground"
                  )}>
                    {stat.change}
                    {stat.trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />}
                    {stat.trend === "down" && <ArrowDownRight className="w-3.5 h-3.5 ml-0.5" />}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-0.5">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Growth Trends</CardTitle>
            </CardHeader>
            <CardContent className="h-[240px] p-4 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px'}}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Occupancy Level (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-[240px] p-4 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px'}}
                  />
                  <Line type="monotone" dataKey="occupancy" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{r: 3, strokeWidth: 1.5}} activeDot={{r: 5}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

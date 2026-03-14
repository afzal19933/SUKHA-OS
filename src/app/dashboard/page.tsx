
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
  Info,
  CalendarDays,
  Plus,
  Receipt,
  Tag
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
import { cn, formatAppDate, generateInvoiceNumber, numberToWords } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc, addDoc, updateDoc } from "firebase/firestore";
import { parseISO, differenceInDays } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];

export default function DashboardPage() {
  const { entityId, role } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  
  // Quick Action States
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const [isQuickCheckoutOpen, setIsQuickCheckoutOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    checkIn: new Date().toISOString().split('T')[0], 
    checkOut: "",
    bookingSource: "Direct"
  });

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

  const typesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "room_types");
  }, [db, entityId]);
  const { data: roomTypes } = useCollection(typesQuery);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

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

  // Actions
  const handleQuickBook = (room: any) => {
    setSelectedRoom(room);
    setSelectedMetric(null);
    setIsQuickResOpen(true);
  };

  const handleQuickCheckoutAction = (room: any) => {
    const reservation = checkedInReservations?.find(r => r.roomNumber?.toString() === room.roomNumber?.toString() && (!isParadise || r.building === room.building));
    if (!reservation) {
      toast({ variant: "destructive", title: "Reservation Not Found", description: "Could not locate active guest for this room." });
      return;
    }
    setSelectedRoom(room);
    setSelectedResForCheckout(reservation);
    setSelectedMetric(null);
    setIsQuickCheckoutOpen(true);
  };

  const [selectedResForCheckout, setSelectedResForCheckout] = useState<any>(null);

  const processQuickReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !selectedRoom || !newRes.guestName) return;
    setIsProcessing(true);

    try {
      const resData = {
        entityId,
        guestName: newRes.guestName,
        building: selectedRoom.building || "",
        roomNumber: selectedRoom.roomNumber,
        stayType: "Daily",
        checkInDate: newRes.checkIn,
        checkOutDate: newRes.checkOut || null,
        status: "checked_in", // Quick book assumes immediate check-in
        numberOfGuests: 1,
        bookingSource: newRes.bookingSource,
        actualCheckInTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "hotel_properties", entityId, "reservations"), resData);
      
      const roomRef = doc(db, "hotel_properties", entityId, "rooms", selectedRoom.id);
      await updateDoc(roomRef, { status: 'occupied', updatedAt: new Date().toISOString() });

      toast({ title: "Guest Checked-In", description: `${newRes.guestName} assigned to Room ${selectedRoom.roomNumber}` });
      setIsQuickResOpen(false);
      setNewRes({ guestName: "", checkIn: new Date().toISOString().split('T')[0], checkOut: "", bookingSource: "Direct" });
    } catch (err) {
      toast({ variant: "destructive", title: "Reservation Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processQuickCheckout = async () => {
    if (!entityId || !selectedResForCheckout || !selectedRoom) return;
    setIsProcessing(true);

    try {
      // 1. Calculate Billing
      const arrival = parseISO(selectedResForCheckout.checkInDate);
      const departure = new Date();
      const nights = Math.max(differenceInDays(departure, arrival), 1);
      
      const roomType = roomTypes?.find(t => t.id === selectedRoom.roomTypeId);
      const baseRate = roomType?.baseRate || 0;
      const subtotal = baseRate * nights;
      const cgst = subtotal * 0.025;
      const sgst = subtotal * 0.025;
      const totalAmount = subtotal + cgst + sgst;

      // 2. Generate Invoice
      const invoiceNumber = generateInvoiceNumber();
      const invoiceData = {
        entityId,
        invoiceNumber,
        reservationId: selectedResForCheckout.id,
        guestDetails: {
          name: selectedResForCheckout.guestName,
          address: selectedResForCheckout.address || "TBD",
          contact: selectedResForCheckout.contact || "TBD",
          gstin: selectedResForCheckout.guestGstin || "N/A",
          state: selectedResForCheckout.state || "Kerala"
        },
        stayDetails: {
          arrivalDate: selectedResForCheckout.checkInDate,
          departureDate: new Date().toISOString().split('T')[0],
          roomNumber: selectedResForCheckout.roomNumber,
          placeOfSupply: "Kerala"
        },
        items: [{ name: `Stay (${nights} Nights)`, qty: nights, price: baseRate, gstRate: 5, amount: subtotal }],
        subtotal, cgst, sgst, totalAmount,
        totalInWords: numberToWords(Math.round(totalAmount)),
        status: "paid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "hotel_properties", entityId, "invoices"), invoiceData);

      // 3. Update Reservation
      await updateDoc(doc(db, "hotel_properties", entityId, "reservations", selectedResForCheckout.id), {
        status: 'checked_out',
        actualCheckOutTime: new Date().toISOString(),
        invoiceNumber,
        updatedAt: new Date().toISOString()
      });

      // 4. Update Room Status
      await updateDoc(doc(db, "hotel_properties", entityId, "rooms", selectedRoom.id), {
        status: 'dirty',
        updatedAt: new Date().toISOString()
      });

      toast({ title: "Checkout Complete", description: `Invoice ${invoiceNumber} generated.` });
      setIsQuickCheckoutOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Checkout Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Metric Drill-down Content
  const drillDownContent = useMemo(() => {
    if (!selectedMetric) return null;

    switch (selectedMetric) {
      case 'occupied':
      case 'total_occupied':
        return {
          title: "Occupied Rooms",
          description: "Active guests in house",
          items: rooms?.filter(r => r.status.includes('occupied')).map(r => {
            const res = checkedInReservations?.find(res => res.roomNumber?.toString() === r.roomNumber?.toString() && (!isParadise || res.building === r.building));
            return {
              id: r.id,
              primary: `Room ${r.roomNumber}`,
              secondary: res?.guestName || "Guest Details Pending",
              extra: res?.bookingSource || "Unknown",
              icon: MapPin,
              badge: r.status.replace('_', ' '),
              raw: r,
              actionLabel: "Check-Out"
            };
          })
        };
      case 'vacant_ready':
        return {
          title: "Vacant Ready Rooms",
          description: "Available for immediate check-in",
          items: rooms?.filter(r => r.status === 'available').map(r => ({
            id: r.id,
            primary: `Room ${r.roomNumber}`,
            secondary: `Floor ${r.floor}`,
            extra: roomTypes?.find(t => t.id === r.roomTypeId)?.name || "Room",
            icon: ShieldCheck,
            badge: "Available",
            raw: r,
            actionLabel: "Book Room"
          }))
        };
      case 'vacant_dirty':
        return {
          title: "Vacant Dirty Rooms",
          description: "Rooms requiring housekeeping",
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
          description: "Housekeeping in progress",
          items: rooms?.filter(r => r.status.includes('cleaning')).map(r => ({
            id: r.id,
            primary: `Room ${r.roomNumber}`,
            secondary: `Floor ${r.floor}`,
            extra: "Cleaning",
            icon: Brush,
            badge: r.status.replace('_', ' ')
          }))
        };
      case 'arrivals':
        return {
          title: "Today's Arrivals",
          description: "Confirmed bookings for today",
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
          title: "Today's Revenue",
          description: "Settlements processed today",
          items: invoices?.filter(inv => inv.createdAt?.startsWith(new Date().toISOString().split('T')[0])).map(inv => ({
            id: inv.id,
            primary: inv.invoiceNumber,
            secondary: inv.guestDetails?.name || inv.guestName,
            extra: `₹${inv.totalAmount?.toLocaleString()}`,
            icon: TrendingUp,
            badge: inv.status
          }))
        };
      default:
        return null;
    }
  }, [selectedMetric, rooms, checkedInReservations, todayArrivals, invoices, roomTypes, isParadise]);

  if (roomsLoading) {
    return <AppLayout><div className="flex items-center justify-center h-[50vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppLayout>;
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
              <Card key={stat.id} className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedMetric(stat.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
                      <stat.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className={cn("flex items-center text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider", stat.trend === "up" ? "bg-emerald-50 text-emerald-600" : stat.trend === "down" ? "bg-rose-50 text-rose-600" : "bg-muted text-muted-foreground")}>
                      {stat.change} {stat.trend === "up" && <ArrowUpRight className="w-2 h-2 ml-0.5" />}
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-lg font-bold mt-0.5">{stat.value}</h3>
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
              <Card key={stat.id} className="border-none shadow-sm cursor-pointer group hover:bg-secondary/30 transition-all" onClick={() => setSelectedMetric(stat.id)}>
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-secondary transition-colors", stat.color)}><stat.icon className="w-3.5 h-3.5" /></div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    <h4 className="text-sm font-bold">{stat.value}</h4>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Drill-down Detail Dialog */}
        <Dialog open={!!selectedMetric} onOpenChange={(open) => !open && setSelectedMetric(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> {drillDownContent?.title}</DialogTitle>
              <DialogDescription className="text-xs">{drillDownContent?.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="mt-4 h-[350px] pr-4">
              <div className="space-y-2.5">
                {drillDownContent?.items && drillDownContent.items.length > 0 ? (
                  drillDownContent.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg"><item.icon className="w-3.5 h-3.5 text-primary" /></div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{item.primary}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">{item.secondary}</span>
                            {item.extra && <span className="text-[10px] text-muted-foreground border-l pl-2">{item.extra}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge variant="outline" className="text-[8px] uppercase font-bold tracking-tight h-4 px-1.5">{item.badge}</Badge>
                        {item.actionLabel && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-[9px] font-bold uppercase text-primary border border-primary/20 hover:bg-primary/5"
                            onClick={() => {
                              if (item.actionLabel === "Book Room") handleQuickBook(item.raw);
                              if (item.actionLabel === "Check-Out") handleQuickCheckoutAction(item.raw);
                            }}
                          >
                            {item.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12"><p className="text-xs text-muted-foreground font-bold uppercase">No records found</p></div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Quick Booking Dialog */}
        <Dialog open={isQuickResOpen} onOpenChange={setIsQuickResOpen}>
          <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden">
            <div className="bg-primary p-4 text-primary-foreground">
              <DialogTitle className="text-sm font-bold flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Quick Check-In</DialogTitle>
              <DialogDescription className="text-[10px] text-primary-foreground/80">Room {selectedRoom?.roomNumber} | {selectedRoom?.building}</DialogDescription>
            </div>
            <form onSubmit={processQuickReservation} className="p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase font-bold">Guest Name</Label>
                <Input placeholder="Enter guest name" value={newRes.guestName} onChange={e => setNewRes({...newRes, guestName: e.target.value})} required className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Check-Out Date</Label>
                  <Input type="date" value={newRes.checkOut} onChange={e => setNewRes({...newRes, checkOut: e.target.value})} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Source</Label>
                  <Select value={newRes.bookingSource} onValueChange={v => setNewRes({...newRes, bookingSource: v})}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOKING_SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-9 font-bold text-[11px]" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3 h-3 mr-2" />}
                Confirm Check-In
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Quick Checkout Dialog */}
        <Dialog open={isQuickCheckoutOpen} onOpenChange={setIsQuickCheckoutOpen}>
          <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden">
            <div className="bg-destructive p-4 text-white">
              <DialogTitle className="text-sm font-bold flex items-center gap-2"><Receipt className="w-4 h-4" /> Guest Settlement</DialogTitle>
              <DialogDescription className="text-[10px] text-white/80">Verify folio and generate final invoice</DialogDescription>
            </div>
            {selectedResForCheckout && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold">{selectedResForCheckout.guestName}</h3>
                      <p className="text-[8px] uppercase font-bold text-muted-foreground">Room {selectedRoom?.roomNumber} | Daily Stay</p>
                    </div>
                    <Badge className="text-[8px] bg-emerald-50 text-emerald-600 uppercase">In House</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[9px] uppercase font-bold text-muted-foreground border-t pt-2">
                    <div className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> In: {formatAppDate(selectedResForCheckout.checkInDate)}</div>
                    <div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> {selectedResForCheckout.bookingSource}</div>
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg text-center border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Estimated Settlement</p>
                  <p className="text-lg font-black text-primary">₹{(roomTypes?.find(t => t.id === selectedRoom?.roomTypeId)?.baseRate || 0).toLocaleString()}+</p>
                </div>
                <Button variant="destructive" className="w-full h-10 font-bold text-[11px]" onClick={processQuickCheckout} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Receipt className="w-3 h-3 mr-2" />}
                  GENERATE GST INVOICE & CHECK-OUT
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

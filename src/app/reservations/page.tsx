"use client";

import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Loader2, 
  Receipt,
  MoreVertical,
  Trash2,
  FilterX,
  CalendarDays,
  Calendar as CalendarIcon,
  Building2,
  DoorOpen,
  Users,
  IndianRupee,
  ChevronRight,
  Edit2,
  Filter,
  ArrowRight,
  AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, doc, query, orderBy, addDoc, where, updateDoc, deleteDoc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, isWithinInterval, addDays, isAfter } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { triggerWhatsAppAutomation } from "@/services/whatsapp-service";
import { broadcastNotification } from "@/firebase/notifications";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];

export default function ReservationsPage() {
  const { entityId: activeEntityId, role: currentUserRole, availableProperties } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin" || currentUserRole === "frontdesk" || currentUserRole === "manager";

  // State Management
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("current");
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  // Filter States
  const [nameSearch, setNameSearch] = useState("");
  const [dateFilter, setDateFilter] = useState('this_week'); // Default view
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form State (shared for add/edit)
  const [resForm, setResForm] = useState({ 
    guestName: "", 
    roomNumber: "", 
    roomId: "",
    bookingSource: "Direct", 
    phoneNumber: "", 
    checkIn: new Date().toISOString().split('T')[0], 
    checkOut: "", 
    negotiatedRate: "",
    totalGuests: "1",
    targetEntityId: activeEntityId || "",
    status: "confirmed"
  });

  // Load selected reservation into edit form
  useEffect(() => {
    if (selectedRes) {
      setResForm({
        guestName: selectedRes.guestName || "",
        roomNumber: selectedRes.roomNumber || "",
        roomId: selectedRes.roomId || "",
        bookingSource: selectedRes.bookingSource || "Direct",
        phoneNumber: selectedRes.phoneNumber || "",
        checkIn: selectedRes.checkInDate || "",
        checkOut: selectedRes.checkOutDate || "",
        negotiatedRate: selectedRes.negotiatedRate?.toString() || "",
        totalGuests: selectedRes.totalGuests?.toString() || "1",
        targetEntityId: selectedRes.entityId || activeEntityId || "",
        status: selectedRes.status || "confirmed"
      });
    }
  }, [selectedRes, activeEntityId]);

  // Reset form when adding new
  const openAddDialog = () => {
    setResForm({
      guestName: "", 
      roomNumber: "", 
      roomId: "",
      bookingSource: "Direct", 
      phoneNumber: "", 
      checkIn: new Date().toISOString().split('T')[0], 
      checkOut: "", 
      negotiatedRate: "",
      totalGuests: "1",
      targetEntityId: activeEntityId || "",
      status: "confirmed"
    });
    setIsAddOpen(true);
  };

  // Queries
  const reservationsQuery = useMemoFirebase(() => {
    if (!activeEntityId) return null;
    return query(collection(db, "hotel_properties", activeEntityId, "reservations"), orderBy("checkInDate", "desc"));
  }, [db, activeEntityId]);

  const roomsQuery = useMemoFirebase(() => {
    const targetId = resForm.targetEntityId || activeEntityId;
    if (!targetId) return null;
    return query(collection(db, "hotel_properties", targetId, "rooms"), orderBy("roomNumber"));
  }, [db, activeEntityId, resForm.targetEntityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

  // Filtering Logic
  const filteredReservations = useMemo(() => {
    if (!reservations || !mounted) return [];
    
    return reservations.filter(res => {
      // 1. Name Search
      const matchesName = (res.guestName || "").toLowerCase().includes(nameSearch.toLowerCase());
      if (!matchesName) return false;

      // 2. Tab Filter (Current vs Upcoming)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInDate = new Date(res.checkInDate);
      
      if (activeTab === 'upcoming' && !isAfter(checkInDate, today)) return false;

      // 3. Date Range Filter
      if (dateFilter === 'all') return true;
      
      if (dateFilter === 'this_week') {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        return isWithinInterval(checkInDate, { start, end });
      }
      
      if (dateFilter === 'this_month') {
        return checkInDate.getMonth() === today.getMonth() && checkInDate.getFullYear() === today.getFullYear();
      }
      
      if (dateFilter === 'custom') {
        if (!customStart || !customEnd) return true;
        return isWithinInterval(checkInDate, { start: customStart, end: customEnd });
      }

      return true;
    });
  }, [reservations, nameSearch, dateFilter, customStart, customEnd, activeTab, mounted]);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = resForm.targetEntityId || activeEntityId;
    if (!targetId || !canEdit || !resForm.guestName) return;

    const resData = { 
      entityId: targetId, 
      guestName: resForm.guestName, 
      phoneNumber: resForm.phoneNumber, 
      roomNumber: resForm.roomNumber, 
      roomId: resForm.roomId,
      checkInDate: resForm.checkIn, 
      checkOutDate: resForm.checkOut || null, 
      negotiatedRate: parseFloat(resForm.negotiatedRate) || 0, 
      totalGuests: parseInt(resForm.totalGuests) || 1,
      status: "confirmed", 
      bookingSource: resForm.bookingSource, 
      createdAt: new Date().toISOString() 
    };

    try {
      await addDoc(collection(db, "hotel_properties", targetId, "reservations"), resData);
      
      const activeProp = availableProperties.find(p => p.id === targetId);
      const propName = activeProp?.name || "Property";

      broadcastNotification(db, {
        title: "New Reservation",
        message: `New booking confirmed for ${resForm.guestName} at ${propName}.`,
        type: 'info',
        entityId: targetId,
        propertyName: propName
      });

      if (resForm.phoneNumber) {
        triggerWhatsAppAutomation(db, 'booking_created', { ...resData, checkIn: resForm.checkIn, checkOut: resForm.checkOut });
      }
      toast({ title: "Reservation confirmed" });
      setIsAddOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to create reservation" });
    }
  };

  const handleUpdateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntityId || !selectedRes || !canEdit) return;

    const resRef = doc(db, "hotel_properties", activeEntityId, "reservations", selectedRes.id);
    const activeProp = availableProperties.find(p => p.id === activeEntityId);
    const propName = activeProp?.name || "Property";

    const updateData = {
      guestName: resForm.guestName,
      phoneNumber: resForm.phoneNumber,
      roomNumber: resForm.roomNumber,
      roomId: resForm.roomId,
      checkInDate: resForm.checkIn,
      checkOutDate: resForm.checkOut || null,
      negotiatedRate: parseFloat(resForm.negotiatedRate) || 0,
      totalGuests: parseInt(resForm.totalGuests) || 1,
      bookingSource: resForm.bookingSource,
      status: resForm.status,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(resRef, updateData);
      
      // Trigger specific check-in/out clinical voice alerts
      if (resForm.status === 'checked_in' && selectedRes.status !== 'checked_in') {
        broadcastNotification(db, {
          title: "Guest Checked In",
          message: `New check-in to ${propName}: ${resForm.guestName} has arrived in Room ${resForm.roomNumber}.`,
          type: 'checkin',
          entityId: activeEntityId,
          propertyName: propName
        });
      } else if (resForm.status === 'checked_out' && selectedRes.status !== 'checked_out') {
        broadcastNotification(db, {
          title: "Guest Checked Out",
          message: `New check-out from ${propName}: ${resForm.guestName} has vacated Room ${resForm.roomNumber}.`,
          type: 'checkout',
          entityId: activeEntityId,
          propertyName: propName
        });
      }

      toast({ title: "Reservation updated" });
      setIsEditOpen(false);
      setSelectedRes(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const handleDeleteReservation = async () => {
    if (!activeEntityId || !selectedRes || !canEdit) return;
    try {
      await deleteDoc(doc(db, "hotel_properties", activeEntityId, "reservations", selectedRes.id));
      toast({ title: "Reservation deleted" });
      setIsEditOpen(false);
      setSelectedRes(null);
      setIsDeleteAlertOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Deletion failed" });
    }
  };

  const LocalFilterBar = () => (
    <div className="flex flex-wrap items-center gap-2 mb-6 p-2 bg-secondary/20 rounded-2xl border border-dashed border-primary/20">
      <div className="flex items-center gap-2 px-3">
        <Filter className="w-3.5 h-3.5 text-primary" />
        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Period</span>
      </div>
      
      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="h-8 w-32 text-[10px] font-bold bg-white text-primary rounded-xl shadow-sm border-none">
          <SelectValue placeholder="All Time" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="this_week" className="text-[10px] font-bold">This Week</SelectItem>
          <SelectItem value="this_month" className="text-[10px] font-bold">This Month</SelectItem>
          <SelectItem value="all" className="text-[10px] font-bold">All Time</SelectItem>
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
          <span className="text-[9px] font-black text-primary/40">TO</span>
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
    </div>
  );

  const ReservationFormFields = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Property Entity</Label>
          <Select value={resForm.targetEntityId} onValueChange={v => setResForm({...resForm, targetEntityId: v, roomNumber: "", roomId: ""})}>
            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {availableProperties.map(p => (
                <SelectItem key={`prop-opt-${p.id}`} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Assign Room</Label>
          <Select value={resForm.roomId} onValueChange={v => {
            const selectedRoom = rooms?.find(r => r.id === v);
            setResForm({...resForm, roomId: v, roomNumber: selectedRoom?.roomNumber || ""});
          }}>
            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
              <SelectValue placeholder="Select Room" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {rooms?.map(r => (
                <SelectItem key={`room-opt-${r.id}`} value={r.id} className="text-xs font-bold">Room {r.roomNumber}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Guest Full Name</Label>
        <Input 
          placeholder="Ex: Mohammed Aslam" 
          value={resForm.guestName} 
          onChange={e => setResForm({...resForm, guestName: e.target.value})} 
          required 
          className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Mobile Number</Label>
          <Input 
            placeholder="+91..." 
            value={resForm.phoneNumber} 
            onChange={e => setResForm({...resForm, phoneNumber: e.target.value})} 
            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Total Guests</Label>
          <Input 
            type="number" 
            value={resForm.totalGuests} 
            onChange={e => setResForm({...resForm, totalGuests: e.target.value})} 
            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Check-In Date</Label>
          <Input 
            type="date" 
            value={resForm.checkIn} 
            onChange={e => setResForm({...resForm, checkIn: e.target.value})} 
            required 
            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Check-Out Date</Label>
          <Input 
            type="date" 
            value={resForm.checkOut} 
            onChange={e => setResForm({...resForm, checkOut: e.target.value})} 
            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Booking Source</Label>
          <Select value={resForm.bookingSource} onValueChange={v => setResForm({...resForm, bookingSource: v})}>
            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {BOOKING_SOURCES.map(s => <SelectItem key={`src-${s}`} value={s} className="text-xs font-bold">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Negotiated Rate (₹)</Label>
          <div className="relative">
            <Input 
              type="number" 
              placeholder="0.00" 
              value={resForm.negotiatedRate} 
              onChange={e => setResForm({...resForm, negotiatedRate: e.target.value})} 
              className="h-11 pl-8 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
            />
            <IndianRupee className="absolute left-3 top-3.5 w-3.5 h-3.5 text-primary" />
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Reservation Status</Label>
          <Select value={resForm.status} onValueChange={v => setResForm({...resForm, status: v})}>
            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="confirmed" className="text-xs font-bold">Confirmed</SelectItem>
              <SelectItem value="checked_in" className="text-xs font-bold">Checked In</SelectItem>
              <SelectItem value="checked_out" className="text-xs font-bold">Checked Out</SelectItem>
              <SelectItem value="cancelled" className="text-xs font-bold text-rose-600">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500" suppressHydrationWarning>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Reservations</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Front Desk Booking Management</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search guests..." 
                className="pl-9 h-10 text-xs rounded-xl bg-white border-none shadow-sm font-bold" 
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            
            {canEdit && (
              <Button onClick={openAddDialog} className="h-10 px-6 font-black text-xs uppercase rounded-xl shadow-xl shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> New Booking
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="current" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList className="bg-white border p-1 rounded-xl h-10 shadow-sm">
              <TabsTrigger value="current" className="rounded-lg text-[11px] font-bold px-6 uppercase">Current View</TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-lg text-[11px] font-bold px-6 uppercase">Upcoming Bookings</TabsTrigger>
            </TabsList>
            
            <LocalFilterBar />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
            <Table>
              <TableHeader className="bg-primary">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="h-14 text-[10px] font-black uppercase pl-10 text-primary-foreground">Room</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-primary-foreground">Guest Name</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Check-in</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Check-out</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Source</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-right text-primary-foreground">Rate</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Status</TableHead>
                  <TableHead className="w-16 pr-10 text-primary-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-24"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredReservations.length > 0 ? (filteredReservations.map((res) => (
                  <TableRow 
                    key={res.id} 
                    className="group hover:bg-primary/5 transition-colors border-b border-secondary/50 cursor-pointer"
                    onClick={() => { setSelectedRes(res); setIsEditOpen(true); }}
                  >
                    <TableCell className="pl-10 py-5">
                      <span className="text-sm font-black text-primary">{res.roomNumber || "TBD"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight text-slate-800">{res.guestName}</span>
                        {res.phoneNumber && <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{res.phoneNumber}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">
                        {formatAppDate(res.checkInDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">
                        {res.checkOutDate ? formatAppDate(res.checkOutDate) : 'TBD'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-black uppercase bg-secondary/50 border-none px-2.5 h-6">
                        {res.bookingSource}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-black text-slate-700">₹{(res.negotiatedRate || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-3 h-6 rounded-xl",
                        res.status === 'confirmed' ? "bg-emerald-500" : 
                        res.status === 'checked_in' ? "bg-blue-500" : 
                        res.status === 'checked_out' ? "bg-slate-500" : "bg-rose-500"
                      )}>
                        {res.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                  </TableRow>
                ))) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-32">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <CalendarDays className="w-12 h-12" />
                        <p className="text-[11px] font-black uppercase tracking-widest">No matching reservations found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Tabs>

        {/* Add Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-primary p-8 text-white">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Create Reservation</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase text-white/70 tracking-widest mt-1">Record a new property booking.</DialogDescription>
            </div>
            
            <ScrollArea className="max-h-[80vh]">
              <form onSubmit={handleAddReservation} className="p-8">
                <ReservationFormFields />
                <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 mt-8">
                  Confirm Reservation
                </Button>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Edit/Modify Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(o) => { if (!o) { setIsEditOpen(false); setSelectedRes(null); } }}>
          <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-end">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Modify Booking</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase text-white/70 tracking-widest mt-1">Audit or update existing reservation.</DialogDescription>
              </div>
              <Badge className="bg-white/20 text-white border-none text-[9px] font-black uppercase h-6 mb-1">
                Ref: {selectedRes?.id.slice(-6).toUpperCase()}
              </Badge>
            </div>
            
            <ScrollArea className="max-h-[80vh]">
              <form onSubmit={handleUpdateReservation} className="p-8">
                <ReservationFormFields />
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDeleteAlertOpen(true)}
                    className="h-14 font-black uppercase tracking-[0.1em] rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Purge Record
                  </Button>
                  <Button type="submit" className="h-14 font-black uppercase tracking-[0.1em] rounded-2xl shadow-xl shadow-primary/20 bg-indigo-600 hover:bg-indigo-700">
                    <Edit2 className="w-4 h-4 mr-2" /> Save Changes
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert */}
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                Permanent Data Removal
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold uppercase tracking-tight">
                Are you absolutely sure you want to delete this reservation? This action is irreversible and will remove all associated billing context.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteReservation} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[10px]">
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

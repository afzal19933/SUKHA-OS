
"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Loader2, 
  Receipt,
  User,
  CalendarDays,
  Tag,
  MoreVertical,
  Edit2,
  Trash2,
  Filter,
  X,
  MapPin,
  Globe
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
import { cn, formatAppDate, generateInvoiceNumber, numberToWords } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { sendNotification } from "@/firebase/notifications";
import { parseISO, differenceInDays } from "date-fns";

const BOOKING_SOURCES = [
  "Direct", 
  "Walkin", 
  "MMT", 
  "Agoda", 
  "Airbnb", 
  "Ayursiha", 
  "Travel Agent", 
  "Corporate"
];

const STATUS_OPTIONS = ["confirmed", "checked_in", "checked_out", "cancelled"];

const BUILDINGS = ["Old Apartment", "New Apartment"];
const STAY_TYPES: Record<string, string[]> = {
  "Old Apartment": ["Daily", "Monthly", "Yearly"],
  "New Apartment": ["Daily"],
  "default": ["Daily", "Monthly", "Yearly"]
};

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin", "frontdesk", "manager"].includes(currentUserRole || "");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [editingRes, setEditingRes] = useState<any>(null);

  // Filter States
  const [nameSearch, setNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    building: "",
    roomNumber: "", 
    stayType: "Daily",
    checkIn: "", 
    checkOut: "",
    guests: "1",
    requests: "",
    bookingSource: "Direct"
  });

  const [checkInForm, setCheckInForm] = useState({
    nationality: "Indian",
    idType: "Aadhar",
    idNumber: "",
    address: "",
    contact: "",
    state: "Kerala"
  });

  // Queries
  const reservationsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "reservations"), orderBy("checkInDate", "desc"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

  // Filtering Logic
  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(res => {
      const matchesName = res.guestName?.toLowerCase().includes(nameSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      const matchesSource = sourceFilter === "all" || res.bookingSource === sourceFilter;
      const matchesRoom = roomFilter === "all" || res.roomNumber?.toString() === roomFilter;
      
      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && res.checkInDate >= startDate;
      if (endDate) matchesDate = matchesDate && res.checkInDate <= endDate;
      
      return matchesName && matchesStatus && matchesSource && matchesRoom && matchesDate;
    });
  }, [reservations, nameSearch, statusFilter, sourceFilter, roomFilter, startDate, endDate]);

  const clearFilters = () => {
    setNameSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
    setRoomFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const filteredRoomsForForm = useMemo(() => {
    if (!rooms) return [];
    if (!isParadise) return rooms;
    return rooms.filter(r => r.building === (isEditOpen ? editingRes?.building : newRes.building) || !r.building);
  }, [rooms, newRes.building, editingRes?.building, isParadise, isEditOpen]);

  const availableStayTypes = useMemo(() => {
    const building = isEditOpen ? editingRes?.building : newRes.building;
    if (!isParadise) return STAY_TYPES.default;
    return STAY_TYPES[building] || ["Daily"];
  }, [newRes.building, editingRes?.building, isParadise, isEditOpen]);

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !user || !newRes.guestName || !newRes.roomNumber) return;

    const resRef = collection(db, "hotel_properties", entityId, "reservations");
    const resData = {
      entityId,
      guestName: newRes.guestName,
      building: isParadise ? newRes.building : "",
      roomNumber: newRes.roomNumber,
      stayType: newRes.stayType,
      checkInDate: newRes.checkIn,
      checkOutDate: newRes.checkOut || null,
      status: "confirmed",
      numberOfGuests: parseInt(newRes.guests),
      specialRequests: newRes.requests,
      bookingSource: newRes.bookingSource,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(resRef, resData);

    sendNotification(db, user.uid, entityId, {
      title: "New Reservation Confirmed",
      message: `${newRes.guestName} booked Room ${newRes.roomNumber}`,
      type: "info"
    });

    toast({ title: "Reservation created", description: `Confirmed for ${newRes.guestName}` });
    setIsAddOpen(false);
    setNewRes({ guestName: "", building: "", roomNumber: "", stayType: "Daily", checkIn: "", checkOut: "", guests: "1", requests: "", bookingSource: "Direct" });
  };

  const handleUpdateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !editingRes) return;

    const resRef = doc(db, "hotel_properties", entityId, "reservations", editingRes.id);
    updateDocumentNonBlocking(resRef, {
      ...editingRes,
      updatedAt: new Date().toISOString()
    });

    toast({ title: "Reservation Updated" });
    setIsEditOpen(false);
    setEditingRes(null);
  };

  const handleDeleteReservation = (resId: string) => {
    if (!entityId || !window.confirm("Are you sure you want to permanently delete this reservation record?")) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    deleteDocumentNonBlocking(resRef);
    toast({ title: "Reservation Deleted" });
  };

  const generateInvoice = async (res: any) => {
    if (!entityId || !res) return;

    const arrival = parseISO(res.checkInDate);
    const departure = new Date();
    const nights = Math.max(differenceInDays(departure, arrival), 1);

    const roomNumStr = res.roomNumber?.toString().trim();
    const room = rooms?.find(r => r.roomNumber?.toString().trim() === roomNumStr && (!isParadise || r.building === res.building));
    
    const baseRate = res.negotiatedRate || 0;
    const subtotal = baseRate * nights;
    
    const cgst = subtotal * 0.025;
    const sgst = subtotal * 0.025;
    const totalAmount = subtotal + cgst + sgst;

    const invoiceNumber = generateInvoiceNumber();

    const invoiceData = {
      entityId,
      invoiceNumber,
      reservationId: res.id,
      guestDetails: {
        name: res.guestName,
        address: res.address || "TBD",
        contact: res.contact || "TBD",
        gstin: res.guestGstin || "N/A",
        state: res.state || "Kerala"
      },
      stayDetails: {
        arrivalDate: res.checkInDate,
        departureDate: new Date().toISOString().split('T')[0],
        roomNumber: res.roomNumber,
        placeOfSupply: "Kerala"
      },
      items: [
        { 
          name: `${res.stayType} Stay (${nights} Units)`, 
          qty: nights, 
          price: baseRate, 
          gstRate: 5,
          amount: subtotal 
        }
      ],
      subtotal,
      cgst,
      sgst,
      totalAmount,
      totalInWords: numberToWords(Math.round(totalAmount)),
      status: "paid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "invoices"), invoiceData);
    return invoiceNumber;
  };

  const updateStatus = async (resId: string, status: string) => {
    if (!entityId || !user) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    const currentRes = reservations?.find(r => r.id === resId);

    const updateData: any = { 
      status, 
      updatedAt: new Date().toISOString() 
    };

    if (status === 'checked_in') {
      updateData.actualCheckInTime = new Date().toISOString();
      updateData.nationality = checkInForm.nationality;
      updateData.idType = checkInForm.idType;
      updateData.idNumber = checkInForm.idNumber;
      updateData.address = checkInForm.address;
      updateData.contact = checkInForm.contact;
      updateData.state = checkInForm.state;
    }

    if (status === 'checked_out') {
      setIsProcessingCheckout(true);
      const invNo = await generateInvoice(currentRes);
      updateData.actualCheckOutTime = new Date().toISOString();
      updateData.invoiceNumber = invNo;
      setIsProcessingCheckout(false);
    }
    
    updateDocumentNonBlocking(resRef, updateData);
    
    if (currentRes?.roomNumber && rooms) {
      const roomNumStr = currentRes.roomNumber.toString().trim();
      const room = rooms.find(r => r.roomNumber?.toString().trim() === roomNumStr && (!isParadise || r.building === currentRes.building));
      if (room) {
        const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
        const newRoomStatus = status === 'checked_in' ? 'occupied' : status === 'checked_out' ? 'dirty' : room.status;
        updateDocumentNonBlocking(roomRef, { status: newRoomStatus, updatedAt: new Date().toISOString() });
      }
    }

    toast({ title: "Status Updated" });
    setIsDetailsOpen(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-[10px] mt-0.5 uppercase font-bold tracking-wider">Stay Management & Billing Folios</p>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 px-6 font-bold shadow-md text-xs bg-primary">
                    <Plus className="w-4 h-4 mr-2" /> New Reservation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold">Create Reservation</DialogTitle>
                    <DialogDescription className="text-xs">Secure a room for an upcoming guest stay.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddReservation} className="space-y-4 pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold">Guest Name</Label>
                      <Input 
                        placeholder="Full Name" 
                        value={newRes.guestName} 
                        onChange={e => setNewRes({...newRes, guestName: e.target.value})} 
                        required 
                        className="h-10 text-sm" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {isParadise && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold">Building</Label>
                          <Select value={newRes.building} onValueChange={val => setNewRes({...newRes, building: val, roomNumber: "", stayType: "Daily"})}>
                            <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {BUILDINGS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-[10px] uppercase font-bold">Stay Type</Label>
                        <Select value={newRes.stayType} onValueChange={val => setNewRes({...newRes, stayType: val})}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {availableStayTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Assign Room</Label>
                        <Select onValueChange={val => setNewRes({...newRes, roomNumber: val})} required value={newRes.roomNumber}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {filteredRoomsForForm?.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(r => (
                              <SelectItem key={r.id} value={r.roomNumber}>
                                {r.roomNumber} ({r.status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Source</Label>
                        <Select value={newRes.bookingSource} onValueChange={val => setNewRes({...newRes, bookingSource: val})}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Check-In Date</Label>
                        <Input type="date" value={newRes.checkIn} onChange={e => setNewRes({...newRes, checkIn: e.target.value})} required className="h-10 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Check-Out Date</Label>
                        <Input type="date" value={newRes.checkOut} onChange={e => setNewRes({...newRes, checkOut: e.target.value})} required className="h-10 text-sm" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 font-bold uppercase tracking-widest mt-2">Confirm Booking</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Professional Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search Guest..." 
                className="pl-9 h-10 text-[11px] bg-secondary/20" 
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 text-[11px] bg-secondary/20"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-10 text-[11px] bg-secondary/20"><SelectValue placeholder="Booking Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="h-10 text-[11px] bg-secondary/20"><SelectValue placeholder="Room #" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms?.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(r => (
                  <SelectItem key={r.id} value={r.roomNumber}>{r.roomNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="h-10 text-[11px] bg-secondary/20" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="From" />
            <Input type="date" className="h-10 text-[11px] bg-secondary/20" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="To" />
          </div>
          {(nameSearch || statusFilter !== 'all' || sourceFilter !== 'all' || roomFilter !== 'all' || startDate || endDate) && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-[10px] font-bold text-rose-600 hover:bg-rose-50">
                <X className="w-3 h-3 mr-1" /> Clear All Filters
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50 border-b">
              <TableRow>
                <TableHead className="px-6 h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground">Guest Name</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground">Source</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground">Status</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground text-center">Room</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground text-center">Check-In</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground text-center">Check-Out</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black tracking-widest text-muted-foreground text-center">Stay Type</TableHead>
                <TableHead className="w-12 h-11 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredReservations.length > 0 ? (
                filteredReservations.map((res) => (
                  <TableRow key={res.id} className="hover:bg-secondary/10 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-[13px] tracking-tight">{res.guestName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10 tracking-tighter h-5">
                        {res.bookingSource}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase tracking-tighter h-5 px-2",
                        res.status === 'checked_in' ? "bg-emerald-500 hover:bg-emerald-600" :
                        res.status === 'checked_out' ? "bg-slate-500 hover:bg-slate-600" :
                        res.status === 'confirmed' ? "bg-blue-500 hover:bg-blue-600" : "bg-rose-500 hover:bg-rose-600"
                      )}>
                        {res.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        {isParadise && res.building && (
                          <span className="text-[8px] uppercase font-bold text-muted-foreground mb-0.5">{res.building}</span>
                        )}
                        <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-black text-sm border border-emerald-100">
                          {res.roomNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-[11px] text-muted-foreground">
                      {formatAppDate(res.checkInDate)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-[11px] text-primary">
                      {res.checkOutDate ? formatAppDate(res.checkOutDate) : "TBD"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight h-5">
                        {res.stayType || "Daily"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="text-xs font-bold py-2" onClick={() => { 
                            setSelectedRes(res); 
                            setCheckInForm({ 
                              nationality: res.nationality || "Indian", 
                              idType: res.idType || "Aadhar", 
                              idNumber: res.idNumber || "", 
                              address: res.address || "", 
                              contact: res.contact || "", 
                              state: res.state || "Kerala" 
                            }); 
                            setIsDetailsOpen(true); 
                          }}>
                            <Receipt className="w-3.5 h-3.5 mr-2 text-emerald-600" /> View/Manage Folio
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem className="text-xs font-bold py-2" onClick={() => { setEditingRes(res); setIsEditOpen(true); }}>
                                <Edit2 className="w-3.5 h-3.5 mr-2 text-primary" /> Edit Reservation
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs font-bold py-2 text-rose-600" onClick={() => handleDeleteReservation(res.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Record
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="text-center py-20 text-[11px] text-muted-foreground uppercase font-black tracking-widest bg-secondary/5">No records found matching filters</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Reservation Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Edit Reservation</DialogTitle>
              <DialogDescription className="text-xs">Modify details for {editingRes?.guestName}</DialogDescription>
            </DialogHeader>
            {editingRes && (
              <form onSubmit={handleUpdateReservation} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold">Guest Name</Label>
                  <Input value={editingRes.guestName} onChange={e => setEditingRes({...editingRes, guestName: e.target.value})} required className="h-10 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {isParadise && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold">Building</Label>
                      <Select value={editingRes.building} onValueChange={val => setEditingRes({...editingRes, building: val, roomNumber: ""})}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{BUILDINGS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-[10px] uppercase font-bold">Stay Type</Label>
                    <Select value={editingRes.stayType} onValueChange={val => setEditingRes({...editingRes, stayType: val})}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableStayTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold">Assign Room</Label>
                    <Select onValueChange={val => setEditingRes({...editingRes, roomNumber: val})} value={editingRes.roomNumber}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {filteredRoomsForForm?.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(r => (
                          <SelectItem key={r.id} value={r.roomNumber}>{r.roomNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold">Source</Label>
                    <Select value={editingRes.bookingSource} onValueChange={val => setEditingRes({...editingRes, bookingSource: val})}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold">Check-In</Label>
                    <Input type="date" value={editingRes.checkInDate} onChange={e => setEditingRes({...editingRes, checkInDate: e.target.value})} className="h-10 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold">Check-Out</Label>
                    <Input type="date" value={editingRes.checkOutDate} onChange={e => setEditingRes({...editingRes, checkOutDate: e.target.value})} className="h-10 text-sm" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-bold uppercase tracking-widest mt-2">Save Changes</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Folio Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden">
            <div className="bg-primary p-5 text-primary-foreground">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Receipt className="w-5 h-5" /> Guest Folio Summary
              </DialogTitle>
              <DialogDescription className="text-xs text-primary-foreground/80">Manage stay status and final settlement</DialogDescription>
            </div>
            {selectedRes && (
              <div className="p-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold tracking-tight">{selectedRes.guestName}</h3>
                      <span className="text-[9px] text-muted-foreground font-black uppercase mt-0.5">
                        {isParadise && selectedRes.building ? `${selectedRes.building} - ` : ""}
                        {selectedRes.stayType} Stay
                      </span>
                    </div>
                    <Badge className="text-[9px] font-black uppercase tracking-tight bg-primary/10 text-primary border-primary/20 h-5">
                      {selectedRes.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase text-muted-foreground border-t pt-3 tracking-widest">
                    <div className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-primary" /> IN: {formatAppDate(selectedRes.checkInDate)}</div>
                    <div className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-primary" /> RM: {selectedRes.roomNumber}</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {selectedRes.status === 'confirmed' && (
                    <div className="space-y-4">
                      <div className="space-y-3 border-t pt-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Check-In Requirements</Label>
                        <Input placeholder="Guest Contact Number" className="h-9 text-xs bg-secondary/20" value={checkInForm.contact} onChange={(e) => setCheckInForm({...checkInForm, contact: e.target.value})} />
                        <Input placeholder="Permanent Address" className="h-9 text-xs bg-secondary/20" value={checkInForm.address} onChange={(e) => setCheckInForm({...checkInForm, address: e.target.value})} />
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="ID Type (e.g. Aadhar)" className="h-9 text-xs bg-secondary/20" value={checkInForm.idType} onChange={(e) => setCheckInForm({...checkInForm, idType: e.target.value})} />
                          <Input placeholder="ID Document Number" className="h-9 text-xs bg-secondary/20" value={checkInForm.idNumber} onChange={(e) => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                        </div>
                      </div>
                      <Button className="w-full h-11 text-xs font-bold uppercase tracking-widest shadow-lg" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>
                        Complete Check-In
                      </Button>
                    </div>
                  )}
                  {selectedRes.status === 'checked_in' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-secondary/30 rounded-2xl border text-center space-y-1">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live Room Rate</p>
                        <p className="text-xl font-black text-primary">₹{selectedRes.negotiatedRate?.toLocaleString() || "0"}</p>
                      </div>
                      <Button variant="destructive" className="w-full h-11 text-xs font-bold uppercase tracking-widest shadow-xl" onClick={() => updateStatus(selectedRes.id, 'checked_out')} disabled={isProcessingCheckout}>
                        {isProcessingCheckout ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Receipt className="w-4 h-4 mr-2" />}
                        Settle Folio & Check-Out
                      </Button>
                    </div>
                  )}
                  {selectedRes.status === 'checked_out' && (
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[11px] font-black uppercase text-emerald-700 tracking-widest">Stay Closed & Settled</p>
                      <p className="text-[10px] mt-2 font-mono text-emerald-600 bg-white inline-block px-3 py-1 rounded-lg border">INV: {selectedRes.invoiceNumber || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

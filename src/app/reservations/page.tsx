
"use client";

import { useState, useMemo } from "react";
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
  MessageSquare,
  CalendarDays,
  Tag,
  MapPin,
  Building2
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
import { collection, doc, query, orderBy, addDoc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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
import { triggerWhatsAppAutomation } from "@/services/whatsapp-service";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin", "frontdesk", "manager"].includes(currentUserRole || "");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Filter States
  const [nameSearch, setNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    roomNumber: "", 
    bookingSource: "Direct",
    phoneNumber: "",
    checkIn: "",
    checkOut: "",
    negotiatedRate: ""
  });

  const [checkInForm, setCheckInForm] = useState({
    idNumber: "",
    contact: "",
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

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(res => {
      const matchesName = res.guestName?.toLowerCase().includes(nameSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      const matchesSource = sourceFilter === "all" || res.bookingSource === sourceFilter;
      const matchesRoom = roomSearch === "" || res.roomNumber?.toString().includes(roomSearch);
      
      const resDate = res.checkInDate;
      const matchesStart = !startDate || resDate >= startDate;
      const matchesEnd = !endDate || resDate <= endDate;

      return matchesName && matchesStatus && matchesSource && matchesRoom && matchesStart && matchesEnd;
    });
  }, [reservations, nameSearch, statusFilter, sourceFilter, roomSearch, startDate, endDate]);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !user || !newRes.guestName || !newRes.roomNumber) return;

    const resData = {
      entityId,
      guestName: newRes.guestName,
      phoneNumber: newRes.phoneNumber,
      roomNumber: newRes.roomNumber,
      checkInDate: newRes.checkIn,
      checkOutDate: newRes.checkOut || null,
      negotiatedRate: parseFloat(newRes.negotiatedRate) || 0,
      status: "confirmed",
      bookingSource: newRes.bookingSource,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "hotel_properties", entityId, "reservations"), resData);

    // Send WhatsApp Automation
    if (newRes.phoneNumber) {
      triggerWhatsAppAutomation(db, 'booking_created', {
        ...resData,
        checkIn: newRes.checkIn,
        checkOut: newRes.checkOut
      });
    }

    toast({ title: "Reservation confirmed" });
    setIsAddOpen(false);
    setNewRes({ guestName: "", roomNumber: "", bookingSource: "Direct", phoneNumber: "", checkIn: "", checkOut: "", negotiatedRate: "" });
  };

  const updateStatus = async (resId: string, status: string) => {
    if (!entityId) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    const currentRes = reservations?.find(r => r.id === resId);

    const updateData: any = { status, updatedAt: new Date().toISOString() };

    if (status === 'checked_in') {
      updateData.actualCheckInTime = new Date().toISOString();
      Object.assign(updateData, checkInForm);
      if (currentRes?.phoneNumber) {
        triggerWhatsAppAutomation(db, 'guest_checkin', {
          entityId, guestName: currentRes.guestName, phoneNumber: currentRes.phoneNumber
        });
      }
    }

    if (status === 'checked_out') {
      updateData.actualCheckOutTime = new Date().toISOString();
      if (currentRes?.phoneNumber) {
        triggerWhatsAppAutomation(db, 'guest_checkout', {
          entityId, guestName: currentRes.guestName, phoneNumber: currentRes.phoneNumber
        });
      }
    }
    
    updateDocumentNonBlocking(resRef, updateData);
    
    // Update room status
    if (currentRes?.roomNumber && rooms) {
      const room = rooms.find(r => r.roomNumber === currentRes.roomNumber);
      if (room) {
        const newRoomStatus = status === 'checked_in' ? 'occupied' : status === 'checked_out' ? 'dirty' : room.status;
        updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", room.id), { status: newRoomStatus });
      }
    }

    toast({ title: `Guest ${status.replace('_', ' ')}` });
    setIsDetailsOpen(false);
  };

  const clearFilters = () => {
    setNameSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
    setRoomSearch("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-[1200px] mx-auto text-center">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Guest Reservations</h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-black tracking-[0.2em]">Operational Ledger & WhatsApp Hub</p>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 px-8 font-black shadow-xl text-xs uppercase tracking-widest">
                    <Plus className="w-4 h-4 mr-2" /> New Booking
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase text-primary">Create Reservation</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-wider">Secure room and automate WhatsApp notification.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddReservation} className="space-y-5 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Guest Name</Label>
                        <Input value={newRes.guestName} onChange={e => setNewRes({...newRes, guestName: e.target.value})} required className="h-10 text-xs bg-secondary/30 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">WhatsApp #</Label>
                        <Input placeholder="+91..." value={newRes.phoneNumber} onChange={e => setNewRes({...newRes, phoneNumber: e.target.value})} required className="h-10 text-xs bg-secondary/30 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Assign Room</Label>
                        <Select onValueChange={val => setNewRes({...newRes, roomNumber: val})} required>
                          <SelectTrigger className="h-10 text-xs bg-secondary/30 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {rooms?.filter(r => r.status === 'available').map(r => (
                              <SelectItem key={r.id} value={r.roomNumber}>{r.roomNumber}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Booking Source</Label>
                        <Select value={newRes.bookingSource} onValueChange={val => setNewRes({...newRes, bookingSource: val})}>
                          <SelectTrigger className="h-10 text-xs bg-secondary/30 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>{BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Daily Negotiated Rate</Label>
                      <Input type="number" placeholder="₹" value={newRes.negotiatedRate} onChange={e => setNewRes({...newRes, negotiatedRate: e.target.value})} required className="h-10 text-xs bg-secondary/30 rounded-xl border-primary/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Check-In</Label>
                        <Input type="date" value={newRes.checkIn} onChange={e => setNewRes({...newRes, checkIn: e.target.value})} required className="h-10 text-xs bg-secondary/30 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Check-Out</Label>
                        <Input type="date" value={newRes.checkOut} onChange={e => setNewRes({...newRes, checkOut: e.target.value})} required className="h-10 text-xs bg-secondary/30 rounded-xl" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest mt-2 rounded-2xl shadow-lg">Confirm & Send WhatsApp</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Professional Filter Bar */}
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Advanced Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1.5 text-left">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Guest Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Name..." className="pl-8 h-9 text-[10px] rounded-xl border-none bg-secondary/40" value={nameSearch} onChange={e => setNameSearch(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9 text-[10px] rounded-xl border-none bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-[10px] rounded-xl border-none bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stays</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Arrival From</Label>
              <Input type="date" className="h-9 text-[10px] rounded-xl border-none bg-secondary/40" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Arrival To</Label>
              <Input type="date" className="h-9 text-[10px] rounded-xl border-none bg-secondary/40" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" className="h-9 w-full text-[10px] font-black uppercase hover:bg-rose-50 text-rose-600 rounded-xl" onClick={clearFilters}>
                <FilterX className="w-3.5 h-3.5 mr-2" /> Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center pl-8">Guest Name</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center">Booking Source</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center">Stay Status</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center">Room Unit</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center">Check-In Date</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center">Check-Out Date</TableHead>
                <TableHead className="w-16 pr-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-24"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredReservations.length > 0 ? (
                filteredReservations.map((res) => (
                  <TableRow key={res.id} className="hover:bg-primary/5 transition-colors group border-b border-secondary/50">
                    <TableCell className="font-black text-[13px] text-center pl-8 py-5 uppercase tracking-tight">{res.guestName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/10 px-3 h-6 rounded-lg">{res.bookingSource}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-3 h-6 rounded-lg",
                        res.status === 'checked_in' ? "bg-emerald-500 shadow-md shadow-emerald-100" : res.status === 'confirmed' ? "bg-blue-500 shadow-md shadow-blue-100" : "bg-slate-400"
                      )}>
                        {res.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-secondary/50 text-primary font-black text-sm border border-secondary mx-auto shadow-inner">
                        {res.roomNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-[11px] text-muted-foreground uppercase">{formatAppDate(res.checkInDate)}</TableCell>
                    <TableCell className="text-center font-bold text-[11px] text-primary uppercase">{res.checkOutDate ? formatAppDate(res.checkOutDate) : "OPEN"}</TableCell>
                    <TableCell className="text-center pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-white hover:shadow-md rounded-2xl transition-all">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl">
                          <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer" onClick={() => { setSelectedRes(res); setIsDetailsOpen(true); }}>
                            <Receipt className="w-4 h-4 mr-3 text-emerald-600" /> Manage Folio
                          </DropdownMenuItem>
                          {res.phoneNumber && (
                            <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer text-blue-600" onClick={() => window.open(`https://wa.me/${res.phoneNumber.replace(/\D/g, '')}`, '_blank')}>
                              <MessageSquare className="w-4 h-4 mr-3" /> WhatsApp Guest
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50" onClick={() => deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId!, "reservations", res.id))}>
                            <Trash2 className="w-4 h-4 mr-3" /> Purge Record
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-32 space-y-4">
                    <FilterX className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                    <p className="text-xs font-black uppercase text-muted-foreground">No reservations matching current filters</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Folio Management Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2.5rem]">
            <div className="bg-primary p-8 text-primary-foreground space-y-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase">
                  <Receipt className="w-6 h-6" /> Folio Control
                </DialogTitle>
                <Badge className="bg-white/20 text-white border-none text-[9px] font-black uppercase px-2 py-1">Room {selectedRes?.roomNumber}</Badge>
              </div>
              <DialogDescription className="text-xs text-primary-foreground/70 font-bold uppercase tracking-widest">{selectedRes?.guestName}</DialogDescription>
            </div>
            {selectedRes && (
              <div className="p-8 space-y-6">
                {selectedRes.status === 'confirmed' && (
                  <div className="space-y-5">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mandatory Verification</Label>
                      <Input placeholder="ID Number (Aadhar/Passport)" className="h-12 text-xs bg-secondary/40 border-none rounded-2xl" value={checkInForm.idNumber} onChange={e => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                      <Input placeholder="Contact Number" className="h-12 text-xs bg-secondary/40 border-none rounded-2xl" value={checkInForm.contact} onChange={e => setCheckInForm({...checkInForm, contact: e.target.value})} />
                    </div>
                    <Button className="w-full h-14 font-black uppercase tracking-[0.2em] shadow-2xl rounded-2xl mt-4" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>
                      Activate Check-In
                    </Button>
                  </div>
                )}
                {selectedRes.status === 'checked_in' && (
                  <div className="space-y-6">
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center space-y-1 shadow-inner">
                      <p className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest">Active Folio Value</p>
                      <p className="text-3xl font-black text-emerald-800">₹{selectedRes.negotiatedRate?.toLocaleString()}</p>
                      <p className="text-[9px] uppercase font-black text-emerald-600/50">Base Daily Rate</p>
                    </div>
                    <Button variant="destructive" className="w-full h-14 font-black uppercase tracking-[0.2em] shadow-xl rounded-2xl" onClick={() => updateStatus(selectedRes.id, 'checked_out')}>
                      Final Settle & Purge
                    </Button>
                  </div>
                )}
                {selectedRes.status === 'checked_out' && (
                  <div className="text-center py-8 space-y-4">
                    <Badge className="bg-slate-100 text-slate-600 border-none px-4 py-2 text-xs font-black uppercase">Historical Record</Badge>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">This reservation has been finalized. Access the Accounting module for GST invoice archives.</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

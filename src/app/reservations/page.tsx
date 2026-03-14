
"use client";

import { useState, useMemo, useEffect } from "react";
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
  Globe,
  MessageSquare
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
import { triggerWhatsAppAutomation } from "@/services/whatsapp-service";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];
const BUILDINGS = ["Old Apartment", "New Apartment"];

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

  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    building: "",
    roomNumber: "", 
    stayType: "Daily",
    checkIn: "", 
    checkOut: "",
    guests: "1",
    requests: "",
    bookingSource: "Direct",
    phoneNumber: ""
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

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(res => {
      const matchesName = res.guestName?.toLowerCase().includes(nameSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [reservations, nameSearch, statusFilter]);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !user || !newRes.guestName || !newRes.roomNumber) return;

    const resData = {
      entityId,
      guestName: newRes.guestName,
      phoneNumber: newRes.phoneNumber,
      building: newRes.building,
      roomNumber: newRes.roomNumber,
      stayType: newRes.stayType,
      checkInDate: newRes.checkIn,
      checkOutDate: newRes.checkOut || null,
      status: "confirmed",
      numberOfGuests: parseInt(newRes.guests),
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
    setNewRes({ guestName: "", building: "", roomNumber: "", stayType: "Daily", checkIn: "", checkOut: "", guests: "1", requests: "", bookingSource: "Direct", phoneNumber: "" });
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
      Object.assign(updateData, checkInForm);
      
      // WhatsApp Welcome
      if (currentRes?.phoneNumber) {
        triggerWhatsAppAutomation(db, 'guest_checkin', {
          entityId, guestName: currentRes.guestName, phoneNumber: currentRes.phoneNumber
        });
      }
    }

    if (status === 'checked_out') {
      updateData.actualCheckOutTime = new Date().toISOString();
      // WhatsApp Farewell
      if (currentRes?.phoneNumber) {
        triggerWhatsAppAutomation(db, 'guest_checkout', {
          entityId, guestName: currentRes.guestName, phoneNumber: currentRes.phoneNumber
        });
      }
    }
    
    await updateDocumentNonBlocking(resRef, updateData);
    
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

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1200px] mx-auto text-center">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-[10px] mt-0.5 uppercase font-bold tracking-wider">Stay Management & WhatsApp Automation</p>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 px-6 font-bold shadow-md text-xs">
                    <Plus className="w-4 h-4 mr-2" /> New Reservation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold">Create Reservation</DialogTitle>
                    <DialogDescription className="text-xs">Secure a room and send automated WhatsApp confirmation.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddReservation} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Guest Name</Label>
                        <Input value={newRes.guestName} onChange={e => setNewRes({...newRes, guestName: e.target.value})} required className="h-10 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">WhatsApp Number</Label>
                        <Input placeholder="+91..." value={newRes.phoneNumber} onChange={e => setNewRes({...newRes, phoneNumber: e.target.value})} required className="h-10 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Assign Room</Label>
                        <Select onValueChange={val => setNewRes({...newRes, roomNumber: val})} required>
                          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {rooms?.filter(r => r.status === 'available').map(r => (
                              <SelectItem key={r.id} value={r.roomNumber}>{r.roomNumber}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Source</Label>
                        <Select value={newRes.bookingSource} onValueChange={val => setNewRes({...newRes, bookingSource: val})}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{BOOKING_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Check-In</Label>
                        <Input type="date" value={newRes.checkIn} onChange={e => setNewRes({...newRes, checkIn: e.target.value})} required className="h-10 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Check-Out</Label>
                        <Input type="date" value={newRes.checkOut} onChange={e => setNewRes({...newRes, checkOut: e.target.value})} required className="h-10 text-sm" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 font-bold uppercase tracking-widest mt-2">Confirm & Notify Guest</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search Guest Name..." 
              className="pl-9 h-10 text-[11px] bg-secondary/20 border-none" 
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-10 text-[11px] bg-secondary/20 border-none"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stays</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="checked_out">Checked Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Guest Name</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Source</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Status</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Room</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Check-In</TableHead>
                <TableHead className="h-11 text-[10px] uppercase font-black text-center">Check-Out</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredReservations.map((res) => (
                <TableRow key={res.id} className="hover:bg-primary/5 transition-colors group">
                  <TableCell className="font-bold text-[13px]">{res.guestName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px] uppercase font-black bg-primary/5 text-primary border-primary/10">{res.bookingSource}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[9px] uppercase font-black h-5",
                      res.status === 'checked_in' ? "bg-emerald-500" : res.status === 'confirmed' ? "bg-blue-500" : "bg-slate-500"
                    )}>
                      {res.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-black text-sm border border-emerald-100 mx-auto">
                      {res.roomNumber}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-muted-foreground">{formatAppDate(res.checkInDate)}</TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-primary">{res.checkOutDate ? formatAppDate(res.checkOutDate) : "TBD"}</TableCell>
                  <TableCell className="text-center pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="text-xs font-bold" onClick={() => { setSelectedRes(res); setIsDetailsOpen(true); }}>
                          <Receipt className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Manage Folio
                        </DropdownMenuItem>
                        {res.phoneNumber && (
                          <DropdownMenuItem className="text-xs font-bold text-emerald-600" onClick={() => window.open(`https://wa.me/${res.phoneNumber.replace(/\D/g, '')}`, '_blank')}>
                            <MessageSquare className="w-3.5 h-3.5 mr-2" /> WhatsApp Guest
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-xs font-bold text-rose-600" onClick={() => deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId!, "reservations", res.id))}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Folio Management Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden">
            <div className="bg-primary p-5 text-primary-foreground">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Receipt className="w-5 h-5" /> Guest Folio
              </DialogTitle>
              <DialogDescription className="text-xs text-primary-foreground/80">Room {selectedRes?.roomNumber} | {selectedRes?.guestName}</DialogDescription>
            </div>
            {selectedRes && (
              <div className="p-6 space-y-5">
                {selectedRes.status === 'confirmed' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">ID Verification</Label>
                      <Input placeholder="ID Number (Aadhar/Passport)" className="h-10 text-xs bg-secondary/30" value={checkInForm.idNumber} onChange={e => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                      <Input placeholder="Contact Number" className="h-10 text-xs bg-secondary/30" value={checkInForm.contact} onChange={e => setCheckInForm({...checkInForm, contact: e.target.value})} />
                    </div>
                    <Button className="w-full h-11 font-bold uppercase tracking-widest shadow-lg" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>
                      Complete Check-In
                    </Button>
                  </div>
                )}
                {selectedRes.status === 'checked_in' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[10px] font-black uppercase text-emerald-700">Currently in House</p>
                      <p className="text-xl font-black text-emerald-800 mt-1">₹{selectedRes.negotiatedRate?.toLocaleString()}</p>
                      <p className="text-[8px] uppercase font-bold text-emerald-600">Daily Rate</p>
                    </div>
                    <Button variant="destructive" className="w-full h-11 font-bold uppercase tracking-widest shadow-xl" onClick={() => updateStatus(selectedRes.id, 'checked_out')}>
                      Final Settle & Check-Out
                    </Button>
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

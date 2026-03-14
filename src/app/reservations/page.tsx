
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
  Tag
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
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  
  const [selectedRes, setSelectedRes] = useState<any>(null);
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

  const laundryQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "guest_laundry_orders");
  }, [db, entityId]);

  const typesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "room_types");
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: laundryOrders } = useCollection(laundryQuery);
  const { data: roomTypes } = useCollection(typesQuery);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

  const filteredRoomsForForm = useMemo(() => {
    if (!rooms) return [];
    if (!isParadise) return rooms;
    return rooms.filter(r => r.building === newRes.building || !r.building);
  }, [rooms, newRes.building, isParadise]);

  const availableStayTypes = useMemo(() => {
    if (!isParadise) return STAY_TYPES.default;
    return STAY_TYPES[newRes.building] || ["Daily"];
  }, [newRes.building, isParadise]);

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

  const generateInvoice = async (res: any) => {
    if (!entityId || !res) return;

    const arrival = parseISO(res.checkInDate);
    const departure = new Date();
    const nights = Math.max(differenceInDays(departure, arrival), 1);

    const roomNumStr = res.roomNumber?.toString().trim();
    const room = rooms?.find(r => r.roomNumber?.toString().trim() === roomNumStr && (!isParadise || r.building === res.building));
    const roomType = roomTypes?.find(t => t.id === room?.roomTypeId);
    
    const baseRate = roomType?.baseRate || 0;
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
      <div className="space-y-5 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-[10px] mt-0.5 uppercase font-bold tracking-wider">Stay Management & Billing Folios</p>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8 px-4 font-bold shadow-md text-[10px] bg-primary">
                    <Plus className="w-3 h-3 mr-1.5" /> New Reservation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-bold">Create Reservation</DialogTitle>
                    <DialogDescription className="text-[10px]">Secure a room for an upcoming guest stay.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddReservation} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Guest Name</Label>
                      <Input 
                        placeholder="John Doe" 
                        value={newRes.guestName} 
                        onChange={e => setNewRes({...newRes, guestName: e.target.value})} 
                        required 
                        className="h-8 text-xs" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {isParadise && (
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Building</Label>
                          <Select value={newRes.building} onValueChange={val => setNewRes({...newRes, building: val, roomNumber: "", stayType: "Daily"})}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {BUILDINGS.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1 flex-1">
                        <Label className="text-[9px] uppercase font-bold">Stay Type</Label>
                        <Select value={newRes.stayType} onValueChange={val => setNewRes({...newRes, stayType: val})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {availableStayTypes.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Assign Room</Label>
                        <Select onValueChange={val => setNewRes({...newRes, roomNumber: val})} required value={newRes.roomNumber}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {filteredRoomsForForm?.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(r => (
                              <SelectItem key={r.id} value={r.roomNumber} className="text-xs">
                                {r.roomNumber} ({r.status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Source</Label>
                        <Select value={newRes.bookingSource} onValueChange={val => setNewRes({...newRes, bookingSource: val})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BOOKING_SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Check-In Date</Label>
                        <Input 
                          type="date" 
                          value={newRes.checkIn} 
                          onChange={e => setNewRes({...newRes, checkIn: e.target.value})} 
                          required 
                          className="h-8 text-xs" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Check-Out Date</Label>
                        <Input 
                          type="date" 
                          value={newRes.checkOut} 
                          onChange={e => setNewRes({...newRes, checkOut: e.target.value})} 
                          required 
                          className="h-8 text-xs" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Special Requests</Label>
                      <Input 
                        placeholder="Early check-in, extra towels..." 
                        value={newRes.requests} 
                        onChange={e => setNewRes({...newRes, requests: e.target.value})} 
                        className="h-8 text-xs" 
                      />
                    </div>
                    <Button type="submit" className="w-full h-9 font-bold text-[11px] mt-2">Confirm Booking</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 h-9 text-[10px] uppercase font-bold">Guest Info</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">{isParadise ? "Building / Room" : "Room"}</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">Check-Out</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">Type</TableHead>
                <TableHead className="text-right px-4 h-9 text-[10px] uppercase font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : reservations?.length ? (
                reservations.map((res) => {
                  return (
                    <TableRow key={res.id} className="hover:bg-secondary/5">
                      <TableCell className="px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="font-bold text-[11px]">{res.guestName}</span>
                          <Badge variant="secondary" className="text-[7px] px-1 h-3.5 uppercase">{res.status}</Badge>
                        </div>
                        <div className="text-[8px] text-muted-foreground uppercase mt-0.5 ml-5">{res.bookingSource}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          {isParadise && res.building && (
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">{res.building}</span>
                          )}
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-bold px-2 mt-0.5">{res.roomNumber}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-[10px] font-medium">
                        {res.checkOutDate ? formatAppDate(res.checkOutDate) : "TBD"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="ghost" className="text-[8px] uppercase">{res.stayType || "Daily"}</Badge>
                      </TableCell>
                      <TableCell className="text-right px-4">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-primary" onClick={() => { setSelectedRes(res); setCheckInForm({ nationality: res.nationality || "Indian", idType: res.idType || "Aadhar", idNumber: res.idNumber || "", address: res.address || "", contact: res.contact || "", state: res.state || "Kerala" }); setIsDetailsOpen(true); }}>
                          Folio
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[10px] text-muted-foreground uppercase font-bold">No records found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Folio Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[340px] p-0 overflow-hidden">
            <div className="bg-primary p-4 text-primary-foreground">
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Receipt className="w-4 h-4" /> Guest Folio Summary
              </DialogTitle>
              <DialogDescription className="text-[10px] text-primary-foreground/80">Manage stay status and final settlement</DialogDescription>
            </div>
            {selectedRes && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <h3 className="text-xs font-bold">{selectedRes.guestName}</h3>
                      <span className="text-[8px] text-muted-foreground uppercase">
                        {isParadise && selectedRes.building ? `${selectedRes.building} - ` : ""}
                        {selectedRes.stayType} Stay
                      </span>
                    </div>
                    <Badge className="text-[8px] uppercase font-bold bg-primary/10 text-primary">{selectedRes.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[9px] uppercase font-bold text-muted-foreground border-t pt-2">
                    <div className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> In: {formatAppDate(selectedRes.checkInDate)}</div>
                    <div className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> Room: {selectedRes.roomNumber}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {selectedRes.status === 'confirmed' && (
                    <div className="space-y-3">
                      <div className="space-y-2 border-t pt-3">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground">Check-In Requirements</Label>
                        <Input placeholder="Guest Contact" className="h-7 text-[10px]" value={checkInForm.contact} onChange={(e) => setCheckInForm({...checkInForm, contact: e.target.value})} />
                        <Input placeholder="Guest Address" className="h-7 text-[10px]" value={checkInForm.address} onChange={(e) => setCheckInForm({...checkInForm, address: e.target.value})} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="ID Type" className="h-7 text-[10px]" value={checkInForm.idType} onChange={(e) => setCheckInForm({...checkInForm, idType: e.target.value})} />
                          <Input placeholder="ID Number" className="h-7 text-[10px]" value={checkInForm.idNumber} onChange={(e) => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                        </div>
                      </div>
                      <Button className="w-full h-9 text-[11px] font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>Process Check-In</Button>
                    </div>
                  )}
                  {selectedRes.status === 'checked_in' && (
                    <div className="space-y-2">
                      <Button variant="destructive" className="w-full h-9 text-[11px] font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_out')} disabled={isProcessingCheckout}>
                        {isProcessingCheckout ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Receipt className="w-3 h-3 mr-1.5" />}
                        Generate GST Invoice & Check-Out
                      </Button>
                    </div>
                  )}
                  {selectedRes.status === 'checked_out' && (
                    <div className="p-3 bg-secondary/30 rounded-lg text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Stay Closed</p>
                      <p className="text-[9px] mt-1 italic font-mono">Invoice #{selectedRes.invoiceNumber || 'N/A'}</p>
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


"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Calendar, 
  User, 
  Info,
  CheckCircle2,
  LogOut,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  ArrowRightLeft,
  CreditCard,
  Globe,
  Receipt
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
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, doc, query, where, getDocs } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { sendNotification } from "@/firebase/notifications";

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

const ID_TYPES = [
  "Aadhar",
  "D.L",
  "PAN",
  "Passport"
];

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    roomNumber: "", 
    checkIn: "", 
    checkOut: "",
    guests: "1",
    requests: "",
    bookingSource: "Direct"
  });

  const [checkInForm, setCheckInForm] = useState({
    nationality: "Indian",
    idType: "Aadhar",
    idNumber: ""
  });

  const [editResForm, setEditResForm] = useState<any>(null);

  // Queries
  const reservationsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "reservations");
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const typesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "room_types");
  }, [db, entityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: roomTypes } = useCollection(typesQuery);

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !user) return;

    const resRef = collection(db, "hotel_properties", entityId, "reservations");
    const resData = {
      entityId,
      guestName: newRes.guestName,
      roomNumber: newRes.roomNumber,
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
      message: `${newRes.guestName} booked for Room ${newRes.roomNumber} starting ${formatAppDate(newRes.checkIn)}`,
      type: "info"
    });

    toast({
      title: "Reservation created",
      description: `Confirmed for ${newRes.guestName} via ${newRes.bookingSource}.`,
    });

    setIsAddOpen(false);
    setNewRes({ guestName: "", roomNumber: "", checkIn: "", checkOut: "", guests: "1", requests: "", bookingSource: "Direct" });
  };

  const generateInvoice = async (res: any) => {
    if (!entityId || !res) return;

    // 1. Calculate Stay
    const checkIn = new Date(res.checkInDate);
    const checkOut = new Date();
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // 2. Get Room Rate
    const roomNumStr = res.roomNumber?.toString().trim();
    const room = rooms?.find(r => r.roomNumber?.toString().trim() === roomNumStr);
    const roomType = roomTypes?.find(t => t.id === room?.roomTypeId);
    const baseRate = roomType?.baseRate || 0;
    const roomTotal = baseRate * diffDays;

    // 3. Get Laundry Charges
    const laundryQuery = query(
      collection(db, "hotel_properties", entityId, "guest_laundry_orders"),
      where("reservationId", "==", res.id)
    );
    const laundrySnap = await getDocs(laundryQuery);
    const laundryTotal = laundrySnap.docs.reduce((acc, d) => acc + (d.data().hotelTotal || 0), 0);

    const totalBeforeTax = roomTotal + laundryTotal;
    const gstAmount = totalBeforeTax * 0.05; // Average GST
    const grandTotal = totalBeforeTax + gstAmount;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const invoiceData = {
      entityId,
      invoiceNumber,
      reservationId: res.id,
      guestName: res.guestName,
      roomNumber: res.roomNumber,
      totalAmount: grandTotal,
      balance: 0,
      status: "paid",
      items: [
        { description: `Room Stay (${diffDays} nights)`, amount: roomTotal },
        { description: "Laundry Services", amount: laundryTotal },
        { description: "Taxes (GST)", amount: gstAmount }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "invoices"), invoiceData);
    return invoiceNumber;
  };

  const updateStatus = async (resId: string, status: string) => {
    if (!entityId || !user) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    
    const currentRes = selectedRes?.id === resId ? selectedRes : reservations?.find(r => r.id === resId);

    const updateData: any = { 
      status, 
      updatedAt: new Date().toISOString() 
    };

    if (status === 'checked_in') {
      updateData.actualCheckInTime = new Date().toISOString();
      updateData.nationality = checkInForm.nationality;
      updateData.idType = checkInForm.idType;
      updateData.idNumber = checkInForm.idNumber;

      sendNotification(db, user.uid, entityId, {
        title: "Guest Checked In",
        message: `${currentRes?.guestName} has arrived and is now in Room ${currentRes?.roomNumber}`,
        type: "info"
      });
    }

    if (status === 'checked_out') {
      setIsProcessingCheckout(true);
      const invNo = await generateInvoice(currentRes);
      updateData.actualCheckOutTime = new Date().toISOString();
      updateData.invoiceNumber = invNo;

      sendNotification(db, user.uid, entityId, {
        title: "Guest Checked Out",
        message: `${currentRes?.guestName} vacated Room ${currentRes?.roomNumber}. Invoice ${invNo} generated.`,
        type: "info"
      });
      setIsProcessingCheckout(false);
    }
    
    updateDocumentNonBlocking(resRef, updateData);
    
    if (currentRes && currentRes.roomNumber && rooms) {
      const roomNumStr = currentRes.roomNumber.toString().trim();
      const room = rooms.find(r => 
        r.roomNumber?.toString().trim() === roomNumStr
      );
      
      if (room) {
        const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
        let newRoomStatus = room.status;
        
        if (status === 'checked_in') newRoomStatus = 'occupied';
        if (status === 'checked_out') newRoomStatus = 'dirty';
        
        updateDocumentNonBlocking(roomRef, { 
          status: newRoomStatus, 
          updatedAt: new Date().toISOString() 
        });
      }
    }

    toast({ 
      title: "Status Updated", 
      description: `Reservation is now ${status.replace('_', ' ')}.` 
    });
    
    if (selectedRes?.id === resId) {
      setSelectedRes({ ...selectedRes, ...updateData });
    }
  };

  const handleUpdateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !editResForm) return;

    const resRef = doc(db, "hotel_properties", entityId, "reservations", editResForm.id);
    const updateData = {
      guestName: editResForm.guestName,
      roomNumber: editResForm.roomNumber,
      checkInDate: editResForm.checkInDate,
      checkOutDate: editResForm.checkOutDate || null,
      numberOfGuests: parseInt(editResForm.numberOfGuests),
      specialRequests: editResForm.specialRequests,
      bookingSource: editResForm.bookingSource,
      updatedAt: new Date().toISOString(),
    };

    updateDocumentNonBlocking(resRef, updateData);
    toast({ title: "Reservation updated" });
    setIsEditOpen(false);
    setEditResForm(null);
  };

  const handleDeleteReservation = (id: string) => {
    if (!entityId || !isAdmin) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", id);
    deleteDocumentNonBlocking(resRef);
    toast({ title: "Reservation deleted" });
  };

  const openDetails = (res: any) => {
    setSelectedRes(res);
    setCheckInForm({
      nationality: res.nationality || "Indian",
      idType: res.idType || "Aadhar",
      idNumber: res.idNumber || ""
    });
    setIsDetailsOpen(true);
  };

  const openEdit = (res: any) => {
    setEditResForm({ ...res });
    setIsEditOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-[10px] mt-0.5">Manage guest stays and bookings</p>
          </div>

          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 px-4 font-semibold shadow-md text-xs">
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  New Reservation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[380px]">
                <DialogHeader>
                  <DialogTitle className="text-sm">Add Reservation</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddReservation} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Guest Name</Label>
                    <Input placeholder="John Doe" value={newRes.guestName} onChange={(e) => setNewRes({...newRes, guestName: e.target.value})} required className="h-8 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Room #</Label>
                      <Input placeholder="101" value={newRes.roomNumber} onChange={(e) => setNewRes({...newRes, roomNumber: e.target.value})} required className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Source</Label>
                      <Select value={newRes.bookingSource} onValueChange={(val) => setNewRes({...newRes, bookingSource: val})}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BOOKING_SOURCES.map(source => <SelectItem key={source} value={source} className="text-xs">{source}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Check In</Label>
                      <Input type="date" value={newRes.checkIn} onChange={(e) => setNewRes({...newRes, checkIn: e.target.value})} required className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Guests</Label>
                      <Input type="number" min="1" value={newRes.guests} onChange={(e) => setNewRes({...newRes, guests: e.target.value})} required className="h-8 text-xs" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-9 text-xs font-bold mt-2">Confirm Booking</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search guest..." className="pl-9 h-9 text-xs" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-5 h-9 text-[10px] uppercase font-bold">Guest</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">Room</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">Stay</TableHead>
                <TableHead className="text-center h-9 text-[10px] uppercase font-bold">Status</TableHead>
                <TableHead className="text-right px-5 h-9 text-[10px] uppercase font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : reservations?.length ? (
                reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell className="px-5 font-bold text-xs">{res.guestName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-secondary/50 text-[9px] font-bold">ROOM {res.roomNumber}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-[10px]">
                      {formatAppDate(res.checkInDate)} - {res.checkOutDate ? formatAppDate(res.checkOutDate) : "..."}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[8px] uppercase font-bold",
                        res.status === "confirmed" && "bg-emerald-50 text-emerald-600",
                        res.status === "checked_in" && "bg-blue-50 text-blue-600",
                        res.status === "checked_out" && "bg-gray-100 text-gray-600"
                      )}>
                        {res.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-5">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => openDetails(res)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-[10px] text-muted-foreground uppercase font-bold">No active stays</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-primary" /> Stay Management
              </DialogTitle>
            </DialogHeader>
            {selectedRes && (
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-xl border">
                  <div>
                    <h3 className="text-sm font-bold">{selectedRes.guestName}</h3>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Room {selectedRes.roomNumber} • {selectedRes.bookingSource}</p>
                  </div>
                  <Badge className="text-[9px] uppercase font-bold bg-primary/10 text-primary">{selectedRes.status}</Badge>
                </div>

                {selectedRes.status === 'confirmed' && (
                  <div className="space-y-2.5 p-3 border rounded-xl bg-primary/5">
                    <p className="text-[9px] font-bold uppercase text-primary">Identity Verification (KYC)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-muted-foreground">ID Type</Label>
                        <Select value={checkInForm.idType} onValueChange={(v) => setCheckInForm({...checkInForm, idType: v})}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ID_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-muted-foreground">ID Number</Label>
                        <Input placeholder="Enter #" className="h-7 text-xs" value={checkInForm.idNumber} onChange={(e) => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  {selectedRes.status === 'confirmed' && (
                    <Button className="w-full h-9 text-xs font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>
                      Confirm Arrival & Check-In
                    </Button>
                  )}
                  {selectedRes.status === 'checked_in' && (
                    <Button variant="destructive" className="w-full h-9 text-xs font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_out')} disabled={isProcessingCheckout}>
                      {isProcessingCheckout ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Receipt className="w-3.5 h-3.5 mr-2" />}
                      Generate Invoice & Check-Out
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

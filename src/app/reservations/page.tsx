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
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, doc } from "firebase/firestore";
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

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

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

  const updateStatus = (resId: string, status: string) => {
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
      sendNotification(db, user.uid, entityId, {
        title: "Guest Checked Out",
        message: `${currentRes?.guestName} has vacated Room ${currentRes?.roomNumber}`,
        type: "info"
      });
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
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage guest stays and bookings</p>
          </div>

          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 px-5 font-semibold shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  New Reservation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Add Reservation</DialogTitle>
                  <DialogDescription>Quickly add a new guest booking.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddReservation} className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="guestName" className="text-xs">Guest Name</Label>
                    <Input id="guestName" placeholder="John Doe" value={newRes.guestName} onChange={(e) => setNewRes({...newRes, guestName: e.target.value})} required className="h-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="roomNumber" className="text-xs">Room #</Label>
                      <Input id="roomNumber" placeholder="101" value={newRes.roomNumber} onChange={(e) => setNewRes({...newRes, roomNumber: e.target.value})} required className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bookingSource" className="text-xs">Booking Source</Label>
                      <Select value={newRes.bookingSource} onValueChange={(val) => setNewRes({...newRes, bookingSource: val})}>
                        <SelectTrigger id="bookingSource" className="h-9 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_SOURCES.map(source => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="guests" className="text-xs">Guests</Label>
                      <Input id="guests" type="number" min="1" value={newRes.guests} onChange={(e) => setNewRes({...newRes, guests: e.target.value})} required className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Check In</Label>
                      <Input type="date" value={newRes.checkIn} onChange={(e) => setNewRes({...newRes, checkIn: e.target.value})} required className="h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Check Out</Label>
                      <Input type="date" value={newRes.checkOut} onChange={(e) => setNewRes({...newRes, checkOut: e.target.value})} className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Requests</Label>
                    <Input placeholder="Extra towels, etc." value={newRes.requests} onChange={(e) => setNewRes({...newRes, requests: e.target.value})} className="h-9" />
                  </div>
                  <DialogFooter className="pt-2">
                    <Button type="submit" className="w-full h-9">Confirm Booking</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search guest name or room..." className="pl-9 h-9 text-xs" />
          </div>
          <Button variant="outline" className="h-9 text-xs">
            <Filter className="w-3.5 h-3.5 mr-2" />
            Filter
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[22%] text-left px-5 h-10 text-[11px] uppercase">Guest</TableHead>
                <TableHead className="w-[12%] text-center h-10 text-[11px] uppercase">Room</TableHead>
                <TableHead className="w-[18%] text-center h-10 text-[11px] uppercase">Check-In</TableHead>
                <TableHead className="w-[18%] text-center h-10 text-[11px] uppercase">Check-Out</TableHead>
                <TableHead className="w-[15%] text-center h-10 text-[11px] uppercase">Status</TableHead>
                <TableHead className="w-[15%] text-right px-5 h-10 text-[11px] uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : reservations && reservations.length > 0 ? (
                reservations.map((res) => (
                  <TableRow key={res.id} className="group">
                    <TableCell className="px-5 font-semibold whitespace-nowrap text-xs">
                      {res.guestName}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge variant="outline" className="bg-secondary/50 font-bold px-1.5 py-0.5 text-[9px] uppercase">ROOM {res.roomNumber}</Badge>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap text-[11px] font-medium">
                      {formatAppDate(res.checkInDate)}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap text-[11px] font-medium">
                      {res.checkOutDate ? formatAppDate(res.checkOutDate) : "TBD"}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge className={cn(
                        "text-[8px] px-1.5 py-0.5 font-bold uppercase border",
                        res.status === "confirmed" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200",
                        res.status === "checked_in" && "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
                        res.status === "pending" && "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200",
                        res.status === "checked_out" && "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
                      )}>
                        {(res.status || "confirmed").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-5">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] font-semibold" onClick={() => openDetails(res)}>Details</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    No reservations found. Create your first one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-primary" />
                Stay Details
              </DialogTitle>
            </DialogHeader>
            {selectedRes && (
              <div className="space-y-5 pt-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{selectedRes.guestName}</h3>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Source: {selectedRes.bookingSource || 'Walk-in'}</p>
                  </div>
                  <Badge className={cn(
                    "text-[9px] uppercase font-bold px-2 py-0.5 border",
                    selectedRes.status === "confirmed" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    selectedRes.status === "checked_in" && "bg-blue-50 text-blue-700 border-blue-200",
                    selectedRes.status === "checked_out" && "bg-gray-100 text-gray-700 border-gray-200"
                  )}>
                    {(selectedRes.status || "confirmed").replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3.5 rounded-xl border">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> Room
                    </p>
                    <p className="font-bold text-base">Room {selectedRes.roomNumber}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> Guests
                    </p>
                    <p className="font-bold text-base">{selectedRes.numberOfGuests}</p>
                  </div>
                </div>

                {selectedRes.status === 'confirmed' && (
                  <div className="space-y-3 p-3.5 border rounded-xl bg-primary/5">
                    <p className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> KYC Info
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-muted-foreground">Nationality</Label>
                        <Input placeholder="e.g. Indian" className="h-8 text-xs" value={checkInForm.nationality} onChange={(e) => setCheckInForm({...checkInForm, nationality: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-muted-foreground">ID Type</Label>
                        <Select value={checkInForm.idType} onValueChange={(val) => setCheckInForm({...checkInForm, idType: val})}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ID_TYPES.map(type => (
                              <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-muted-foreground">ID Number</Label>
                      <Input placeholder="ID Number" className="h-8 text-xs" value={checkInForm.idNumber} onChange={(e) => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold">Check-In</p>
                      <p className="text-xs font-medium">{formatAppDate(selectedRes.checkInDate)}</p>
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-[10px] font-semibold">Check-Out</p>
                      <p className="text-xs font-medium">{selectedRes.checkOutDate ? formatAppDate(selectedRes.checkOutDate) : "TBD"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Special Requests</p>
                  <p className="text-xs bg-secondary/50 p-2.5 rounded-lg border italic min-h-[40px]">
                    {selectedRes.specialRequests || 'None.'}
                  </p>
                </div>

                <DialogFooter className="flex-col gap-2.5 sm:flex-col">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {selectedRes.status === 'confirmed' && (
                      <Button className="w-full h-9 text-xs font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>
                        Check-In
                      </Button>
                    )}
                    {selectedRes.status === 'checked_in' && (
                      <Button variant="destructive" className="w-full h-9 text-xs font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_out')}>
                        Check-Out
                      </Button>
                    )}
                    
                    {isAdmin && (
                      <>
                        <Button variant="outline" className="w-full h-9 text-[11px] font-semibold" onClick={() => { setIsDetailsOpen(false); openEdit(selectedRes); }}>
                          Edit Info
                        </Button>
                        <Button variant="ghost" className="w-full h-9 text-[11px] font-semibold text-rose-500" onClick={() => { setIsDetailsOpen(false); handleDeleteReservation(selectedRes.id); }}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

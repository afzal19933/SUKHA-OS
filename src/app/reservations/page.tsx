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
  ArrowRightLeft
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
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
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

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
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
    requests: ""
  });
  const [editResForm, setEditResForm] = useState<any>(null);

  const reservationsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "reservations");
  }, [db, entityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const resRef = collection(db, "hotel_properties", entityId, "reservations");
    const resData = {
      entityId,
      guestName: newRes.guestName,
      roomNumber: newRes.roomNumber,
      checkInDate: newRes.checkIn,
      checkOutDate: newRes.checkOut,
      status: "confirmed",
      numberOfGuests: parseInt(newRes.guests),
      specialRequests: newRes.requests,
      bookingSourceId: "walk-in",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(resRef, resData);

    toast({
      title: "Reservation created",
      description: `Confirmed for ${newRes.guestName} in room ${newRes.roomNumber}.`,
    });

    setIsAddOpen(false);
    setNewRes({ guestName: "", roomNumber: "", checkIn: "", checkOut: "", guests: "1", requests: "" });
  };

  const handleUpdateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !editResForm) return;

    const resRef = doc(db, "hotel_properties", entityId, "reservations", editResForm.id);
    const updateData = {
      guestName: editResForm.guestName,
      roomNumber: editResForm.roomNumber,
      checkInDate: editResForm.checkInDate,
      checkOutDate: editResForm.checkOutDate,
      numberOfGuests: parseInt(editResForm.numberOfGuests),
      specialRequests: editResForm.specialRequests,
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

  const updateStatus = (resId: string, status: string) => {
    if (!entityId) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    
    const updateData: any = { 
      status, 
      updatedAt: new Date().toISOString() 
    };

    if (status === 'checked_in') {
      updateData.actualCheckInTime = new Date().toISOString();
    }
    
    updateDocumentNonBlocking(resRef, updateData);
    
    toast({ 
      title: "Status Updated", 
      description: `Reservation is now ${status.replace('_', ' ')}.` 
    });
    
    if (selectedRes?.id === resId) {
      setSelectedRes({ ...selectedRes, ...updateData });
    }
  };

  const openDetails = (res: any) => {
    setSelectedRes(res);
    setIsDetailsOpen(true);
  };

  const openEdit = (res: any) => {
    setEditResForm({ ...res });
    setIsEditOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground mt-1">Manage guest stays and bookings</p>
          </div>

          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 font-semibold shadow-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  New Reservation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Reservation</DialogTitle>
                  <DialogDescription>Quickly add a new guest booking.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddReservation} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Guest Name</Label>
                    <Input 
                      id="guestName" 
                      placeholder="John Doe" 
                      value={newRes.guestName}
                      onChange={(e) => setNewRes({...newRes, guestName: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="roomNumber">Room #</Label>
                      <Input 
                        id="roomNumber" 
                        placeholder="101" 
                        value={newRes.roomNumber}
                        onChange={(e) => setNewRes({...newRes, roomNumber: e.target.value})}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guests">Number of Guests</Label>
                      <Input 
                        id="guests" 
                        type="number"
                        min="1"
                        value={newRes.guests}
                        onChange={(e) => setNewRes({...newRes, guests: e.target.value})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Check In</Label>
                      <Input 
                        type="date" 
                        value={newRes.checkIn}
                        onChange={(e) => setNewRes({...newRes, checkIn: e.target.value})}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check Out</Label>
                      <Input 
                        type="date" 
                        value={newRes.checkOut}
                        onChange={(e) => setNewRes({...newRes, checkOut: e.target.value})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Special Requests</Label>
                    <Input 
                      placeholder="Late check-in, extra towels, etc." 
                      value={newRes.requests}
                      onChange={(e) => setNewRes({...newRes, requests: e.target.value})}
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full">Confirm Booking</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search guest name or room..." className="pl-10 h-10" />
          </div>
          <Button variant="outline" className="h-10">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50 text-center">
              <TableRow>
                <TableHead className="w-[25%]">Guest</TableHead>
                <TableHead className="text-center">Room</TableHead>
                <TableHead className="text-center">Check-In</TableHead>
                <TableHead className="text-center">Check-Out</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : reservations && reservations.length > 0 ? (
                reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>
                      <div className="font-semibold">{res.guestName}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-secondary/50 font-bold px-2 py-1 text-[10px] whitespace-nowrap">ROOM {res.roomNumber}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs font-medium">{formatAppDate(res.checkInDate)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs font-medium">{formatAppDate(res.checkOutDate)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] px-2 py-0.5 font-bold uppercase whitespace-nowrap border mx-auto",
                        res.status === "confirmed" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200",
                        res.status === "checked_in" && "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
                        res.status === "pending" && "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200",
                        res.status === "checked_out" && "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
                      )}>
                        {(res.status || "confirmed").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => openDetails(res)}>Details</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No reservations found. Create your first one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Reservation Details
              </DialogTitle>
            </DialogHeader>
            {selectedRes && (
              <div className="space-y-6 pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{selectedRes.guestName}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">ID: {selectedRes.id.toUpperCase()}</p>
                  </div>
                  <Badge className={cn(
                    "text-[10px] uppercase font-bold px-3 py-1 border",
                    selectedRes.status === "confirmed" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    selectedRes.status === "checked_in" && "bg-blue-50 text-blue-700 border-blue-200",
                    selectedRes.status === "checked_out" && "bg-gray-100 text-gray-700 border-gray-200"
                  )}>
                    {selectedRes.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-secondary/30 p-4 rounded-xl border">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Room Information
                    </p>
                    <p className="font-bold text-lg">Room {selectedRes.roomNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Occupancy
                    </p>
                    <p className="font-bold text-lg">{selectedRes.numberOfGuests} {selectedRes.numberOfGuests === 1 ? 'Guest' : 'Guests'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold">Check-In Date</p>
                      <p className="text-sm font-medium">{formatAppDate(selectedRes.checkInDate)}</p>
                      {selectedRes.actualCheckInTime && (
                        <p className="text-[10px] text-primary font-bold">Time: {formatAppTime(selectedRes.actualCheckInTime)}</p>
                      )}
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs font-semibold">Check-Out Date</p>
                      <p className="text-sm font-medium">{formatAppDate(selectedRes.checkOutDate)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Special Requests</p>
                  <p className="text-sm bg-secondary/50 p-3 rounded-lg border italic min-h-[60px]">
                    {selectedRes.specialRequests || 'No special requests recorded for this booking.'}
                  </p>
                </div>

                <DialogFooter className="flex-col gap-2 mt-4 sm:flex-col">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {selectedRes.status === 'confirmed' && (
                      <Button 
                        className="w-full" 
                        onClick={() => updateStatus(selectedRes.id, 'checked_in')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Check-In
                      </Button>
                    )}
                    {selectedRes.status === 'checked_in' && (
                      <Button 
                        variant="destructive"
                        className="w-full" 
                        onClick={() => updateStatus(selectedRes.id, 'checked_out')}
                      >
                        <LogOut className="w-4 h-4 mr-2" /> Check-Out
                      </Button>
                    )}
                    
                    {isAdmin && (
                      <>
                        <Button variant="outline" className="w-full" onClick={() => { setIsDetailsOpen(false); openEdit(selectedRes); }}>
                          <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                        </Button>
                        <Button variant="ghost" className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => { setIsDetailsOpen(false); handleDeleteReservation(selectedRes.id); }}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Details</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit/Shift Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                Modify Reservation
              </DialogTitle>
              <DialogDescription>Update details or shift guest to another room.</DialogDescription>
            </DialogHeader>
            {editResForm && (
              <form onSubmit={handleUpdateReservation} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Guest Name</Label>
                  <Input 
                    value={editResForm.guestName}
                    onChange={(e) => setEditResForm({...editResForm, guestName: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3 h-3 text-primary" /> Shift to Room #
                    </Label>
                    <Input 
                      value={editResForm.roomNumber}
                      onChange={(e) => setEditResForm({...editResForm, roomNumber: e.target.value})}
                      required 
                      className="border-primary/50 bg-primary/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guests</Label>
                    <Input 
                      type="number"
                      min="1"
                      value={editResForm.numberOfGuests}
                      onChange={(e) => setEditResForm({...editResForm, numberOfGuests: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Check In</Label>
                    <Input 
                      type="date" 
                      value={editResForm.checkInDate?.split('T')[0]}
                      onChange={(e) => setEditResForm({...editResForm, checkInDate: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check Out</Label>
                    <Input 
                      type="date" 
                      value={editResForm.checkOutDate?.split('T')[0]}
                      onChange={(e) => setEditResForm({...editResForm, checkOutDate: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Special Requests</Label>
                  <Input 
                    value={editResForm.specialRequests}
                    onChange={(e) => setEditResForm({...editResForm, specialRequests: e.target.value})}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full">Save Changes</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

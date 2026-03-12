
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
  Clock
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
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, updateDoc } from "firebase/firestore";
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
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Separator } from "@/components/ui/separator";

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isAddOpen, setIsAddOpen] = useState(false);
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

  const updateStatus = (resId: string, status: string) => {
    if (!entityId) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    updateDocumentNonBlocking(resRef, { 
      status, 
      updatedAt: new Date().toISOString() 
    });
    
    toast({ 
      title: "Status Updated", 
      description: `Reservation is now ${status.replace('_', ' ')}.` 
    });
    
    if (selectedRes?.id === resId) {
      setSelectedRes({ ...selectedRes, status });
    }
  };

  const openDetails = (res: any) => {
    setSelectedRes(res);
    setIsDetailsOpen(true);
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
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : reservations && reservations.length > 0 ? (
                reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>
                      <div className="font-medium">{res.guestName}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">ID: {res.id.slice(0,8)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-secondary/50 font-bold px-2 py-0 h-5">Room {res.roomNumber}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {res.checkInDate} — {res.checkOutDate}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "capitalize text-[10px] px-2 py-0 h-5",
                        res.status === "confirmed" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                        res.status === "checked_in" && "bg-primary/10 text-primary hover:bg-primary/10 border-primary/20",
                        res.status === "pending" && "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
                        res.status === "checked_out" && "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
                      )}>
                        {(res.status || "confirmed").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={() => openDetails(res)}>Details</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
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
                    <p className="text-xs text-muted-foreground font-mono">RES-ID: {selectedRes.id.toUpperCase()}</p>
                  </div>
                  <Badge className={cn(
                    "capitalize px-3 py-1",
                    selectedRes.status === "confirmed" && "bg-emerald-100 text-emerald-700",
                    selectedRes.status === "checked_in" && "bg-primary/10 text-primary",
                    selectedRes.status === "checked_out" && "bg-gray-100 text-gray-700"
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
                      <p className="text-xs font-semibold">Check-In</p>
                      <p className="text-sm font-medium">{selectedRes.checkInDate}</p>
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs font-semibold">Check-Out</p>
                      <p className="text-sm font-medium">{selectedRes.checkOutDate}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Booking Source</p>
                  <p className="text-sm font-medium capitalize flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> {selectedRes.bookingSourceId || 'Walk-in'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Special Requests</p>
                  <p className="text-sm bg-secondary/50 p-3 rounded-lg border italic min-h-[60px]">
                    {selectedRes.specialRequests || 'No special requests recorded for this booking.'}
                  </p>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                  {selectedRes.status === 'confirmed' && (
                    <Button 
                      className="w-full sm:flex-1" 
                      onClick={() => updateStatus(selectedRes.id, 'checked_in')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Check-In Guest
                    </Button>
                  )}
                  {selectedRes.status === 'checked_in' && (
                    <Button 
                      variant="destructive"
                      className="w-full sm:flex-1" 
                      onClick={() => updateStatus(selectedRes.id, 'checked_out')}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Check-Out Guest
                    </Button>
                  )}
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

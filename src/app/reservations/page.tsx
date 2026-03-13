"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  Loader2, 
  Info,
  Receipt,
  AlertCircle,
  CreditCard,
  History
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
import { collection, doc, query, where } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
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
import { isToday, isTomorrow, parseISO } from "date-fns";

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

  // Queries
  const reservationsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "reservations");
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

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);
  const { data: laundryOrders } = useCollection(laundryQuery);
  const { data: roomTypes } = useCollection(typesQuery);

  const getLaundryBalance = (resId: string) => {
    if (!laundryOrders) return 0;
    return laundryOrders
      .filter(o => o.reservationId === resId && o.status !== "paid")
      .reduce((sum, o) => sum + (o.hotelTotal || 0), 0);
  };

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

    toast({ title: "Reservation created" });
    setIsAddOpen(false);
    setNewRes({ guestName: "", roomNumber: "", checkIn: "", checkOut: "", guests: "1", requests: "", bookingSource: "Direct" });
  };

  const generateInvoice = async (res: any) => {
    if (!entityId || !res) return;

    const checkIn = new Date(res.checkInDate);
    const checkOut = new Date();
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const roomNumStr = res.roomNumber?.toString().trim();
    const room = rooms?.find(r => r.roomNumber?.toString().trim() === roomNumStr);
    const roomType = roomTypes?.find(t => t.id === room?.roomTypeId);
    const baseRate = roomType?.baseRate || 0;
    const roomTotal = baseRate * diffDays;

    const totalBeforeTax = roomTotal;
    const gstAmount = totalBeforeTax * 0.05;
    const grandTotal = totalBeforeTax + gstAmount;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "invoices"), {
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
        { description: "Taxes (GST)", amount: gstAmount }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
      const room = rooms.find(r => r.roomNumber?.toString().trim() === roomNumStr);
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
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground text-[9px] mt-0.5 uppercase font-bold">Stay Management & Billing</p>
          </div>

          {isAdmin && (
            <Button className="h-8 px-3 font-semibold shadow-md text-[10px]" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-3 h-3 mr-1.5" /> New Reservation
            </Button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 h-8 text-[9px] uppercase font-bold">Guest</TableHead>
                <TableHead className="text-center h-8 text-[9px] uppercase font-bold">Room</TableHead>
                <TableHead className="text-center h-8 text-[9px] uppercase font-bold">Checkout</TableHead>
                <TableHead className="text-center h-8 text-[9px] uppercase font-bold">Alerts</TableHead>
                <TableHead className="text-right px-4 h-8 text-[9px] uppercase font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : reservations?.length ? (
                reservations.map((res) => {
                  const laundryBalance = getLaundryBalance(res.id);
                  const isCheckoutSoon = res.checkOutDate && (isToday(parseISO(res.checkOutDate)) || isTomorrow(parseISO(res.checkOutDate)));
                  const hasAlert = laundryBalance > 0 && isCheckoutSoon;

                  return (
                    <TableRow key={res.id}>
                      <TableCell className="px-4 font-bold text-[10px]">{res.guestName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-secondary/50 text-[8px] font-bold">ROOM {res.roomNumber}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-[9px]">
                        {res.checkOutDate ? formatAppDate(res.checkOutDate) : "TBD"}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasAlert && (
                          <div className="flex justify-center">
                            <Badge variant="destructive" className="h-4 text-[7px] uppercase px-1 bg-rose-50 text-rose-600 border-rose-100 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Pending Laundry
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold" onClick={() => { setSelectedRes(res); setCheckInForm({ nationality: res.nationality || "Indian", idType: res.idType || "Aadhar", idNumber: res.idNumber || "" }); setIsDetailsOpen(true); }}>
                          Folio
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-[9px] text-muted-foreground uppercase font-bold">No active stays</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[340px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <History className="w-3.5 h-3.5 text-primary" /> Guest Folio Summary
              </DialogTitle>
            </DialogHeader>
            {selectedRes && (
              <div className="space-y-3 pt-1">
                <div className="bg-secondary/30 p-2.5 rounded-xl border space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold">{selectedRes.guestName}</h3>
                    <Badge className="text-[8px] uppercase font-bold bg-primary/10 text-primary">{selectedRes.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[8px] text-muted-foreground uppercase font-bold">
                    <div>Room: {selectedRes.roomNumber}</div>
                    <div>In: {formatAppDate(selectedRes.checkInDate)}</div>
                  </div>
                </div>

                {selectedRes.status === 'checked_in' && (
                  <div className="p-2.5 border rounded-xl bg-amber-50/50 space-y-2">
                    <p className="text-[9px] font-bold uppercase text-amber-700 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Auxiliary Dues
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">Pending Laundry:</span>
                      <span className={cn("text-xs font-bold", getLaundryBalance(selectedRes.id) > 0 ? "text-rose-600" : "text-emerald-600")}>
                        ₹{getLaundryBalance(selectedRes.id).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex-col gap-1.5">
                  {selectedRes.status === 'confirmed' && (
                    <div className="space-y-2 w-full">
                      <div className="p-2.5 border rounded-xl bg-primary/5 space-y-2">
                        <Label className="text-[8px] uppercase text-muted-foreground">Identity Verification</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="ID Type" className="h-6 text-[10px]" value={checkInForm.idType} onChange={(e) => setCheckInForm({...checkInForm, idType: e.target.value})} />
                          <Input placeholder="ID Number" className="h-6 text-[10px]" value={checkInForm.idNumber} onChange={(e) => setCheckInForm({...checkInForm, idNumber: e.target.value})} />
                        </div>
                      </div>
                      <Button className="w-full h-8 text-[10px] font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_in')} disabled={!checkInForm.idNumber}>Confirm Check-In</Button>
                    </div>
                  )}
                  {selectedRes.status === 'checked_in' && (
                    <div className="space-y-1.5 w-full">
                      {getLaundryBalance(selectedRes.id) > 0 && (
                        <p className="text-[7px] text-center text-rose-500 font-bold uppercase mb-1 animate-pulse">
                          Settle Laundry Dues before closing stay
                        </p>
                      )}
                      <Button variant="destructive" className="w-full h-8 text-[10px] font-bold" onClick={() => updateStatus(selectedRes.id, 'checked_out')} disabled={isProcessingCheckout || getLaundryBalance(selectedRes.id) > 0}>
                        {isProcessingCheckout ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Receipt className="w-3 h-3 mr-1.5" />}
                        Final Room Settlement
                      </Button>
                    </div>
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

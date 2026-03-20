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
  Calendar as CalendarIcon,
  Tag,
  MapPin,
  Building2,
  DoorOpen
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { triggerWhatsAppAutomation } from "@/services/whatsapp-service";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];

export default function ReservationsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin" || currentUserRole === "frontdesk" || currentUserRole === "manager";
  const canView = ["owner", "admin", "frontdesk", "manager"].includes(currentUserRole || "");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Filter States
  const [nameSearch, setNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const [newRes, setNewRes] = useState({ guestName: "", roomNumber: "", bookingSource: "Direct", phoneNumber: "", checkIn: "", checkOut: "", negotiatedRate: "" });
  const [checkInForm, setCheckInForm] = useState({ idNumber: "", contact: "" });

  // Queries
  const reservationsQuery = useMemoFirebase(() => entityId ? query(collection(db, "hotel_properties", entityId, "reservations"), orderBy("checkInDate", "desc")) : null, [db, entityId]);
  const roomsQuery = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "rooms") : null, [db, entityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(res => {
      const matchesName = (res.guestName || "").toLowerCase().includes(nameSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      const matchesSource = sourceFilter === "all" || res.bookingSource === sourceFilter;
      const matchesRoom = roomSearch === "" || (res.roomNumber || "").toString().includes(roomSearch);
      const resDate = res.checkInDate ? new Date(res.checkInDate) : null;
      const matchesStart = !startDate || (resDate && resDate >= startDate);
      const matchesEnd = !endDate || (resDate && resDate <= endDate);
      return matchesName && matchesStatus && matchesSource && matchesRoom && matchesStart && matchesEnd;
    });
  }, [reservations, nameSearch, statusFilter, sourceFilter, roomSearch, startDate, endDate]);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit || !newRes.guestName) return;
    const resData = { entityId, guestName: newRes.guestName, phoneNumber: newRes.phoneNumber, roomNumber: newRes.roomNumber, checkInDate: newRes.checkIn, checkOutDate: newRes.checkOut || null, negotiatedRate: parseFloat(newRes.negotiatedRate) || 0, status: "confirmed", bookingSource: newRes.bookingSource, createdAt: new Date().toISOString() };
    await addDoc(collection(db, "hotel_properties", entityId, "reservations"), resData);
    if (newRes.phoneNumber) triggerWhatsAppAutomation(db, 'booking_created', { ...resData, checkIn: newRes.checkIn, checkOut: newRes.checkOut });
    toast({ title: "Reservation confirmed" });
    setIsAddOpen(false);
    setNewRes({ guestName: "", roomNumber: "", bookingSource: "Direct", phoneNumber: "", checkIn: "", checkOut: "", negotiatedRate: "" });
  };

  const updateStatus = async (resId: string, status: string) => {
    if (!entityId || !canEdit) return;
    const resRef = doc(db, "hotel_properties", entityId, "reservations", resId);
    const updateData: any = { status, updatedAt: new Date().toISOString() };
    if (status === 'checked_in') Object.assign(updateData, checkInForm);
    updateDocumentNonBlocking(resRef, updateData);
    toast({ title: `Status Updated` });
    setIsDetailsOpen(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-black text-primary uppercase">Reservations</h1></div>
          <div className="flex gap-2">
            {canEdit && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild><Button className="h-10 px-6 font-black text-xs uppercase rounded-xl shadow-xl"><Plus className="w-4 h-4 mr-2" /> New Booking</Button></DialogTrigger>
                <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
                  <DialogHeader><DialogTitle className="uppercase">Create Reservation</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddReservation} className="space-y-5 pt-4">
                    <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Guest Name</Label><Input value={newRes.guestName} onChange={e => setNewRes({...newRes, guestName: e.target.value})} required className="h-10 bg-secondary/30 rounded-xl" /></div>
                    <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-lg">Confirm</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="h-12 text-[10px] font-black uppercase text-center pl-8 text-primary-foreground">Room</TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase text-center text-primary-foreground">Guest</TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase text-center text-primary-foreground">Status</TableHead>
                <TableHead className="w-16 pr-8 text-primary-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin w-6 h-6 mx-auto" /></TableCell></TableRow>
              ) : filteredReservations.map((res) => (
                <TableRow key={res.id} className="hover:bg-primary/5">
                  <TableCell className="text-center pl-8">#{res.roomNumber}</TableCell>
                  <TableCell className="font-black text-center">{res.guestName}</TableCell>
                  <TableCell className="text-center"><Badge>{res.status}</Badge></TableCell>
                  <TableCell className="text-center pr-8">
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-2xl">
                          <DropdownMenuItem onClick={() => { setSelectedRes(res); setIsDetailsOpen(true); }} className="text-xs font-bold uppercase">Manage Folio</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId!, "reservations", res.id))} className="text-xs font-bold uppercase text-rose-600">Purge</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

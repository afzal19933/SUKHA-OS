"use client";

import { useState, useMemo, useEffect } from "react";
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
  DoorOpen,
  Users,
  IndianRupee,
  ChevronRight
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
import { collection, doc, query, orderBy, addDoc, where } from "firebase/firestore";
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
import { ScrollArea } from "@/components/ui/scroll-area";

const BOOKING_SOURCES = ["Direct", "Walkin", "MMT", "Agoda", "Airbnb", "Ayursiha", "Travel Agent", "Corporate"];

export default function ReservationsPage() {
  const { entityId: activeEntityId, role: currentUserRole, availableProperties } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin" || currentUserRole === "frontdesk" || currentUserRole === "manager";

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Filter States
  const [nameSearch, setNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form State
  const [newRes, setNewRes] = useState({ 
    guestName: "", 
    roomNumber: "", 
    bookingSource: "Direct", 
    phoneNumber: "", 
    checkIn: new Date().toISOString().split('T')[0], 
    checkOut: "", 
    negotiatedRate: "",
    totalGuests: "1",
    targetEntityId: activeEntityId || ""
  });

  // Sync targetEntityId if activeEntityId changes
  useEffect(() => {
    if (activeEntityId && !newRes.targetEntityId) {
      setNewRes(prev => ({ ...prev, targetEntityId: activeEntityId }));
    }
  }, [activeEntityId]);

  // Queries
  const reservationsQuery = useMemoFirebase(() => {
    if (!activeEntityId) return null;
    // If admin, show all reservations, otherwise show property specific
    return query(collection(db, "hotel_properties", activeEntityId, "reservations"), orderBy("checkInDate", "desc"));
  }, [db, activeEntityId]);

  // Room query based on the SELECTED entity in the form
  const roomsQuery = useMemoFirebase(() => {
    const targetId = newRes.targetEntityId || activeEntityId;
    if (!targetId) return null;
    return query(collection(db, "hotel_properties", targetId, "rooms"), orderBy("roomNumber"));
  }, [db, activeEntityId, newRes.targetEntityId]);

  const { data: reservations, isLoading } = useCollection(reservationsQuery);
  const { data: rooms } = useCollection(roomsQuery);

  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter(res => {
      const matchesName = (res.guestName || "").toLowerCase().includes(nameSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [reservations, nameSearch, statusFilter]);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = newRes.targetEntityId || activeEntityId;
    if (!targetId || !canEdit || !newRes.guestName) return;

    const resData = { 
      entityId: targetId, 
      guestName: newRes.guestName, 
      phoneNumber: newRes.phoneNumber, 
      roomNumber: newRes.roomNumber, 
      checkInDate: newRes.checkIn, 
      checkOutDate: newRes.checkOut || null, 
      negotiatedRate: parseFloat(newRes.negotiatedRate) || 0, 
      totalGuests: parseInt(newRes.totalGuests) || 1,
      status: "confirmed", 
      bookingSource: newRes.bookingSource, 
      createdAt: new Date().toISOString() 
    };

    try {
      await addDoc(collection(db, "hotel_properties", targetId, "reservations"), resData);
      
      if (newRes.phoneNumber) {
        triggerWhatsAppAutomation(db, 'booking_created', { ...resData, checkIn: newRes.checkIn, checkOut: newRes.checkOut });
      }

      toast({ title: "Reservation confirmed" });
      setIsAddOpen(false);
      setNewRes({ 
        guestName: "", 
        roomNumber: "", 
        bookingSource: "Direct", 
        phoneNumber: "", 
        checkIn: new Date().toISOString().split('T')[0], 
        checkOut: "", 
        negotiatedRate: "",
        totalGuests: "1",
        targetEntityId: activeEntityId || ""
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to create reservation" });
    }
  };

  const purgeReservation = (res: any) => {
    if (!activeEntityId || !canEdit) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", activeEntityId, "reservations", res.id));
    toast({ title: "Reservation Purged" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Reservations</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Front Desk Booking Management</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search guests..." 
                className="pl-9 h-10 text-xs rounded-xl bg-white border-none shadow-sm font-bold" 
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>
            
            {canEdit && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 px-6 font-black text-xs uppercase rounded-xl shadow-xl shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" /> New Booking
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                  <div className="bg-primary p-8 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Create Reservation</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase text-white/70 tracking-widest mt-1">Record a new property booking.</DialogDescription>
                  </div>
                  
                  <ScrollArea className="max-h-[80vh]">
                    <form onSubmit={handleAddReservation} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Property Entity</Label>
                          <Select value={newRes.targetEntityId} onValueChange={v => setNewRes({...newRes, targetEntityId: v, roomNumber: ""})}>
                            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
                              <SelectValue placeholder="Select Property" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {availableProperties.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Assign Room</Label>
                          <Select value={newRes.roomNumber} onValueChange={v => setNewRes({...newRes, roomNumber: v})}>
                            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
                              <SelectValue placeholder="Select Room" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {rooms?.map(r => (
                                <SelectItem key={r.id} value={r.roomNumber} className="text-xs font-bold">Room {r.roomNumber}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Guest Full Name</Label>
                        <Input 
                          placeholder="Ex: Mohammed Aslam" 
                          value={newRes.guestName} 
                          onChange={e => setNewRes({...newRes, guestName: e.target.value})} 
                          required 
                          className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Mobile Number</Label>
                          <Input 
                            placeholder="+91..." 
                            value={newRes.phoneNumber} 
                            onChange={e => setNewRes({...newRes, phoneNumber: e.target.value})} 
                            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Total Guests</Label>
                          <Input 
                            type="number" 
                            value={newRes.totalGuests} 
                            onChange={e => setNewRes({...newRes, totalGuests: e.target.value})} 
                            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Check-In Date</Label>
                          <Input 
                            type="date" 
                            value={newRes.checkIn} 
                            onChange={e => setNewRes({...newRes, checkIn: e.target.value})} 
                            required 
                            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Check-Out Date</Label>
                          <Input 
                            type="date" 
                            value={newRes.checkOut} 
                            onChange={e => setNewRes({...newRes, checkOut: e.target.value})} 
                            className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Booking Source</Label>
                          <Select value={newRes.bookingSource} onValueChange={v => setNewRes({...newRes, bookingSource: v})}>
                            <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/50 border-none font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {BOOKING_SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs font-bold">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Negotiated Rate (₹)</Label>
                          <div className="relative">
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              value={newRes.negotiatedRate} 
                              onChange={e => setNewRes({...newRes, negotiatedRate: e.target.value})} 
                              className="h-11 pl-8 text-xs rounded-xl bg-secondary/50 border-none font-bold" 
                            />
                            <IndianRupee className="absolute left-3 top-3.5 w-3.5 h-3.5 text-primary" />
                          </div>
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 mt-4">
                        Confirm Reservation
                      </Button>
                    </form>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="h-14 text-[10px] font-black uppercase pl-10 text-primary-foreground">Guest & Stay Period</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Room</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Guests</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Source</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-right text-primary-foreground">Rate</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase text-center text-primary-foreground">Status</TableHead>
                <TableHead className="w-16 pr-10 text-primary-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-24"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredReservations.length > 0 ? (filteredReservations.map((res) => (
                <TableRow key={res.id} className="group hover:bg-primary/5 transition-colors border-b border-secondary/50">
                  <TableCell className="pl-10 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase tracking-tight text-slate-800">{res.guestName}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {formatAppDate(res.checkInDate)} — {res.checkOutDate ? formatAppDate(res.checkOutDate) : 'TBD'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-black text-primary">{res.roomNumber || "TBD"}</span>
                      {res.phoneNumber && <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{res.phoneNumber}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-[11px] font-bold">{res.totalGuests || 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px] font-black uppercase bg-secondary/50 border-none px-2.5 h-6">
                      {res.bookingSource}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black text-slate-700">₹{(res.negotiatedRate || 0).toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[9px] font-black uppercase px-3 h-6 rounded-xl",
                      res.status === 'confirmed' ? "bg-emerald-500" : 
                      res.status === 'checked_in' ? "bg-blue-500" : 
                      res.status === 'checked_out' ? "bg-slate-500" : "bg-rose-500"
                    )}>
                      {res.status?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-10">
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-white hover:shadow-md rounded-xl">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-none shadow-2xl">
                          <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer">
                            <ChevronRight className="w-3.5 h-3.5 mr-3 text-primary" /> Manage Folio
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50" onClick={() => purgeReservation(res)}>
                            <Trash2 className="w-3.5 h-3.5 mr-3" /> Purge Record
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-32">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <CalendarDays className="w-12 h-12" />
                      <p className="text-[11px] font-black uppercase tracking-widest">No active reservations found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

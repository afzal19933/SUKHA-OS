"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  DoorOpen, 
  Trash2, 
  Loader2,
  Package,
  Layers,
  Building2,
  AlertTriangle
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const BUILDINGS = ["Old Apartment", "New Apartment"];

export default function RoomsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [newType, setNewType] = useState({ name: "", rate: "", occupancy: "2" });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", typeId: "", building: "" });

  // Data fetching
  const typesQuery = useMemoFirebase(() => entityId ? query(collection(db, "hotel_properties", entityId, "room_types"), orderBy("name")) : null, [db, entityId]);
  const roomsQuery = useMemoFirebase(() => entityId ? query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber")) : null, [db, entityId]);
  const propertyRef = useMemoFirebase(() => entityId ? doc(db, "hotel_properties", entityId) : null, [db, entityId]);

  const { data: roomTypes, isLoading: typesLoading } = useCollection(typesQuery);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit) return;
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "room_types"), {
      entityId, 
      name: newType.name, 
      baseRate: parseFloat(newType.rate), 
      maxOccupancy: parseInt(newType.occupancy), 
      createdAt: new Date().toISOString(),
    });
    toast({ title: "Room Category Added" });
    setIsTypeOpen(false);
    setNewType({ name: "", rate: "", occupancy: "2" });
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit) return;
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "rooms"), {
      entityId, 
      roomNumber: newRoom.roomNumber, 
      floor: parseInt(newRoom.floor), 
      building: isParadise ? newRoom.building : "", 
      roomTypeId: newRoom.typeId, 
      status: "available", 
      createdAt: new Date().toISOString(),
    });
    toast({ title: "Physical Room Added" });
    setIsRoomOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", typeId: "", building: "" });
  };

  const confirmDelete = () => {
    if (!entityId || !canEdit || !deleteConfirmId) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", deleteConfirmId));
    toast({ title: "Room Deleted" });
    setDeleteConfirmId(null);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Rooms & Units</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">Physical Inventory & Categories</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 text-[10px] font-black uppercase rounded-xl" onClick={() => setIsTypeOpen(true)}>
                <Layers className="w-3.5 h-3.5 mr-1.5" /> New Category
              </Button>
              <Button className="shadow-lg h-9 text-[10px] font-black uppercase rounded-xl" onClick={() => setIsRoomOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Unit
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10 shadow-sm">
            <TabsTrigger value="inventory" className="rounded-lg text-[11px] font-bold px-6 uppercase">Physical Units</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-[11px] font-bold px-6 uppercase">Room Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {roomsLoading ? (
                <div className="col-span-full py-20 flex flex-col items-center">
                  <Loader2 className="animate-spin w-8 h-8 text-primary mb-2" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Indexing units...</p>
                </div>
              ) : rooms && rooms.length > 0 ? (
                rooms.map(room => (
                  <Card key={room.id} className="border-none shadow-sm group rounded-[1.5rem] bg-white overflow-hidden transition-all hover:shadow-md">
                    <CardHeader className="p-4 pb-1 flex flex-row justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <DoorOpen className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-black text-sm uppercase">Room {room.roomNumber}</span>
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(room.id)} className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-muted-foreground uppercase font-black">Floor {room.floor}</p>
                        {room.building && <p className="text-[8px] font-bold uppercase text-primary/60">{room.building}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-primary/10">
                  <Package className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase text-muted-foreground">No units found in database</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typesLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></div>
              ) : roomTypes && roomTypes.length > 0 ? (
                roomTypes.map(type => (
                  <Card key={type.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                    <CardHeader className="p-5 bg-secondary/30">
                      <CardTitle className="text-sm font-black uppercase tracking-tight text-primary">{type.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Base Rate</span>
                        <span className="text-sm font-black">₹{type.baseRate?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Max Guests</span>
                        <span className="text-sm font-black">{type.maxOccupancy} Adults</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-24 text-center border-2 border-dashed rounded-3xl text-muted-foreground font-bold uppercase text-xs">
                  No room categories defined
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Type Dialog */}
        <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2.5rem]">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase text-primary">New Room Category</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Define logical room groupings and pricing.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddType} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Category Name</Label>
                <Input placeholder="Ex: Deluxe Suite" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Base Rate (₹)</Label>
                  <Input type="number" placeholder="0.00" value={newType.rate} onChange={e => setNewType({...newType, rate: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Max Occupancy</Label>
                  <Input type="number" value={newType.occupancy} onChange={e => setNewType({...newType, occupancy: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-xl shadow-xl mt-2">Create Category</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Room Dialog */}
        <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
          <DialogContent className="sm:max-w-[450px] rounded-[2.5rem]">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase text-primary">Add Physical Unit</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Register a new room unit in the property.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddRoom} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Room Number</Label>
                  <Input placeholder="Ex: 101" value={newRoom.roomNumber} onChange={e => setNewRoom({...newRoom, roomNumber: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Floor</Label>
                  <Select value={newRoom.floor} onValueChange={v => setNewRoom({...newRoom, floor: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4", "5"].map(f => <SelectItem key={f} value={f}>Floor {f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Assign Category</Label>
                <Select value={newRoom.typeId} onValueChange={v => setNewRoom({...newRoom, typeId: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none font-bold"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {roomTypes?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isParadise && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Building / Wing</Label>
                  <Select value={newRoom.building} onValueChange={v => setNewRoom({...newRoom, building: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none font-bold"><SelectValue placeholder="Select building" /></SelectTrigger>
                    <SelectContent>
                      {BUILDINGS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-xl shadow-xl mt-2">Commit To Inventory</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                Purge Unit Confirmation
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold uppercase tracking-tight">
                Are you absolutely sure? This will permanently remove the room unit from the inventory. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[10px]">
                Confirm Purge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

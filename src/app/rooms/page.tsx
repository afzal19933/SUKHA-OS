
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
  Edit3, 
  Loader2,
  Tag,
  Building2
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

const BUILDINGS = ["Old Apartment", "New Apartment"];

export default function RoomsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);

  // Form states for adding
  const [newType, setNewType] = useState({ name: "", rate: "", occupancy: "2" });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", typeId: "", building: "Old Apartment" });

  // Form states for editing
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editingType, setEditingType] = useState<any>(null);

  // Data fetching
  const typesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "room_types"), orderBy("name"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber"));
  }, [db, entityId]);

  const { data: roomTypes, isLoading: typesLoading } = useCollection(typesQuery);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "room_types");
    addDocumentNonBlocking(colRef, {
      entityId,
      name: newType.name,
      baseRate: parseFloat(newType.rate),
      maxOccupancy: parseInt(newType.occupancy),
      amenities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Room Category Added" });
    setIsTypeOpen(false);
    setNewType({ name: "", rate: "", occupancy: "2" });
  };

  const handleUpdateType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !editingType) return;

    const docRef = doc(db, "hotel_properties", entityId, "room_types", editingType.id);
    updateDocumentNonBlocking(docRef, {
      name: editingType.name,
      baseRate: parseFloat(editingType.baseRate),
      maxOccupancy: parseInt(editingType.maxOccupancy),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Room Category Updated" });
    setIsEditTypeOpen(false);
    setEditingType(null);
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "rooms");
    addDocumentNonBlocking(colRef, {
      entityId,
      roomNumber: newRoom.roomNumber,
      floor: parseInt(newRoom.floor),
      building: newRoom.building,
      roomTypeId: newRoom.typeId,
      status: "available",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Physical Room Added" });
    setIsRoomOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", typeId: "", building: "Old Apartment" });
  };

  const handleUpdateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !editingRoom) return;

    const docRef = doc(db, "hotel_properties", entityId, "rooms", editingRoom.id);
    updateDocumentNonBlocking(docRef, {
      roomNumber: editingRoom.roomNumber,
      floor: parseInt(editingRoom.floor),
      building: editingRoom.building,
      roomTypeId: editingRoom.roomTypeId,
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Room Updated" });
    setIsEditRoomOpen(false);
    setEditingRoom(null);
  };

  const deleteRoom = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", id));
    toast({ title: "Room Deleted" });
  };

  const openEditRoom = (room: any) => {
    setEditingRoom({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor.toString(),
      building: room.building || "Old Apartment",
      roomTypeId: room.roomTypeId
    });
    setIsEditRoomOpen(true);
  };

  const openEditType = (type: any) => {
    setEditingType({
      id: type.id,
      name: type.name,
      baseRate: type.baseRate.toString(),
      maxOccupancy: type.maxOccupancy.toString()
    });
    setIsEditTypeOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Configure rooms and categories</p>
          </div>
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10">
            <TabsTrigger value="inventory" className="rounded-lg text-xs">Physical Inventory</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-xs">Room Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold">Rooms List</h2>
              {isAdmin && (
                <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-md h-9 text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> Add Room</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">Add Physical Room</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddRoom} className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Building</Label>
                          <Select value={newRoom.building} onValueChange={v => setNewRoom({...newRoom, building: v})}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {BUILDINGS.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Room Number</Label>
                          <Input placeholder="101" value={newRoom.roomNumber} onChange={e => setNewRoom({...newRoom, roomNumber: e.target.value})} required className="h-9" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Floor</Label>
                          <Input type="number" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: e.target.value})} required className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Category</Label>
                          <Select value={newRoom.typeId} onValueChange={v => setNewRoom({...newRoom, typeId: v})} required>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {roomTypes?.map(t => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-9 mt-2">Create Room</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {roomsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin w-5 h-5" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {rooms?.map(room => (
                  <Card key={room.id} className="border-none shadow-sm group hover:shadow-md transition-shadow">
                    <CardHeader className="p-3.5 pb-1 flex flex-row justify-between items-center">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-3.5 h-3.5 text-primary" />
                          <span className="font-bold text-sm">Room {room.roomNumber}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold mt-0.5">{room.building || "Old Apartment"}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => openEditRoom(room)} className="h-6 w-6">
                            <Edit3 className="w-3 h-3 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)} className="h-6 w-6">
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-3.5 pt-1">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Floor {room.floor}</p>
                      <div className="mt-0.5 text-[11px] font-medium truncate">
                        {roomTypes?.find(t => t.id === room.roomTypeId)?.name || "Uncategorized"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold">Categories & Pricing</h2>
              {isAdmin && (
                <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-md h-9 text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Category</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">Create Room Type</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddType} className="space-y-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category Name</Label>
                        <Input placeholder="Deluxe King" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} required className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Rate (Per Unit)</Label>
                        <Input type="number" placeholder="1500" value={newType.rate} onChange={e => setNewType({...newType, rate: e.target.value})} required className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max Occupancy</Label>
                        <Input type="number" value={newType.occupancy} onChange={e => setNewType({...newType, occupancy: e.target.value})} required className="h-9" />
                      </div>
                      <Button type="submit" className="w-full h-9 mt-2">Save Category</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomTypes?.map(type => (
                <Card key={type.id} className="border-none shadow-sm group">
                  <CardHeader className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold">{type.name}</CardTitle>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => openEditType(type)} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit3 className="w-3 h-3 text-primary" />
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground uppercase font-bold">Max Guests: {type.maxOccupancy}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">₹{type.baseRate}</span>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Base Rate</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Room Dialog */}
        <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader><DialogTitle className="text-base">Edit Room</DialogTitle></DialogHeader>
            {editingRoom && (
              <form onSubmit={handleUpdateRoom} className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Building</Label>
                    <Select value={editingRoom.building} onValueChange={v => setEditingRoom({...editingRoom, building: v})}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BUILDINGS.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Room Number</Label>
                    <Input value={editingRoom.roomNumber} onChange={e => setEditingRoom({...editingRoom, roomNumber: e.target.value})} required className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Floor</Label>
                    <Input type="number" value={editingRoom.floor} onChange={e => setEditingRoom({...editingRoom, floor: e.target.value})} required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select value={editingRoom.roomTypeId} onValueChange={v => setEditingRoom({...editingRoom, roomTypeId: v})} required>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roomTypes?.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full h-9 mt-2">Update Room</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

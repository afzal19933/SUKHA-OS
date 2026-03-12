
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
  Tag
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
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

export default function RoomsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRoomOpen, setIsRoomOpen] = useState(false);

  // Form states
  const [newType, setNewType] = useState({ name: "", rate: "", occupancy: "2" });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", typeId: "" });

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

    toast({ title: "Room Type Added" });
    setIsTypeOpen(false);
    setNewType({ name: "", rate: "", occupancy: "2" });
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "rooms");
    addDocumentNonBlocking(colRef, {
      entityId,
      roomNumber: newRoom.roomNumber,
      floor: parseInt(newRoom.floor),
      roomTypeId: newRoom.typeId,
      status: "available",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Physical Room Added" });
    setIsRoomOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", typeId: "" });
  };

  const deleteRoom = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", id));
    toast({ title: "Room Deleted" });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Configure your property's rooms and categories</p>
          </div>
        </div>

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="inventory" className="rounded-lg">Physical Inventory</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg">Room Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Rooms List</h2>
              {isAdmin && (
                <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Add Room</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Physical Room</DialogTitle>
                      <DialogDescription>Assign a room number to a category.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRoom} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Room Number</Label>
                        <Input 
                          placeholder="101" 
                          value={newRoom.roomNumber} 
                          onChange={e => setNewRoom({...newRoom, roomNumber: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Floor</Label>
                        <Input 
                          type="number" 
                          value={newRoom.floor} 
                          onChange={e => setNewRoom({...newRoom, floor: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newRoom.typeId} onValueChange={v => setNewRoom({...newRoom, typeId: v})} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {roomTypes?.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full">Create Room</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {roomsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {rooms?.map(room => (
                  <Card key={room.id} className="border-none shadow-sm group hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2 flex flex-row justify-between items-center">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-primary" />
                        <span className="font-bold text-lg">Room {room.roomNumber}</span>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Floor {room.floor}</p>
                      <div className="mt-2 text-sm font-medium">
                        {roomTypes?.find(t => t.id === room.roomTypeId)?.name || "Uncategorized"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Categories & Pricing</h2>
              {isAdmin && (
                <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> New Category</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Room Type</DialogTitle>
                      <DialogDescription>Define a new category and its base rate.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddType} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input 
                          placeholder="Deluxe King" 
                          value={newType.name} 
                          onChange={e => setNewType({...newType, name: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Base Rate (Per Night)</Label>
                        <Input 
                          type="number" 
                          placeholder="1500" 
                          value={newType.rate} 
                          onChange={e => setNewType({...newType, rate: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Occupancy</Label>
                        <Input 
                          type="number" 
                          value={newType.occupancy} 
                          onChange={e => setNewType({...newType, occupancy: e.target.value})}
                          required 
                        />
                      </div>
                      <Button type="submit" className="w-full">Save Category</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roomTypes?.map(type => (
                <Card key={type.id} className="border-none shadow-sm">
                  <CardHeader className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{type.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">Max Guests: {type.maxOccupancy}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">${type.baseRate}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Base Rate</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tag className="w-4 h-4" />
                      <span>{rooms?.filter(r => r.roomTypeId === type.id).length || 0} Units assigned</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

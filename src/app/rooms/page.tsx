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
  Package
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
} from "@/components/ui/dialog";
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

const BUILDINGS = ["Old Apartment", "New Apartment"];

export default function RoomsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRoomOpen, setIsRoomOpen] = useState(false);

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
      entityId, name: newType.name, baseRate: parseFloat(newType.rate), maxOccupancy: parseInt(newType.occupancy), createdAt: new Date().toISOString(),
    });
    toast({ title: "Room Category Added" });
    setIsTypeOpen(false);
    setNewType({ name: "", rate: "", occupancy: "2" });
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit) return;
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "rooms"), {
      entityId, roomNumber: newRoom.roomNumber, floor: parseInt(newRoom.floor), building: isParadise ? newRoom.building : "", roomTypeId: newRoom.typeId, status: "available", createdAt: new Date().toISOString(),
    });
    toast({ title: "Physical Room Added" });
    setIsRoomOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", typeId: "", building: "" });
  };

  const deleteRoom = (id: string) => {
    if (!entityId || !canEdit) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", id));
    toast({ title: "Room Deleted" });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-2xl font-black text-primary uppercase">Rooms & Units</h1></div>
          {canEdit && (
            <div className="flex gap-2">
              <Button className="shadow-lg h-9 text-[10px] font-black uppercase rounded-xl" onClick={() => setIsRoomOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" /> Add Unit</Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10 shadow-sm">
            <TabsTrigger value="inventory" className="rounded-lg text-[11px] font-bold px-6">Physical Units</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-[11px] font-bold px-6">Room Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {roomsLoading ? (<div className="col-span-full py-10"><Loader2 className="animate-spin mx-auto" /></div>) : rooms?.map(room => (
                <Card key={room.id} className="border-none shadow-sm group rounded-[1.5rem] bg-white">
                  <CardHeader className="p-4 pb-1 flex flex-row justify-between items-center">
                    <div className="flex items-center gap-2"><DoorOpen className="w-4 h-4 text-primary" /><span className="font-black text-sm">Room {room.roomNumber}</span></div>
                    {canEdit && <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)} className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </CardHeader>
                  <CardContent className="p-4 pt-1"><p className="text-[9px] text-muted-foreground uppercase font-black">Floor {room.floor}</p></CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

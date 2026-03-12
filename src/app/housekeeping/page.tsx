
"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Brush, 
  ShieldCheck,
  MoreVertical,
  Loader2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

const STATUS_CONFIG: any = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Clean & Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning" },
  occupied: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
};

export default function HousekeepingPage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", type: "Standard" });

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const { data: rooms, isLoading } = useCollection(roomsQuery);

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId) return;

    const roomsRef = collection(db, "hotel_properties", entityId, "rooms");
    const roomData = {
      entityId,
      roomNumber: newRoom.roomNumber,
      floor: parseInt(newRoom.floor),
      roomTypeId: newRoom.type.toLowerCase(),
      status: "available",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(roomsRef, roomData);
    toast({ title: "Room added", description: `Room ${newRoom.roomNumber} is now in the system.` });
    setIsAddOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", type: "Standard" });
  };

  const updateStatus = (roomId: string, status: string) => {
    if (!entityId) return;
    const roomRef = doc(db, "hotel_properties", entityId, "rooms", roomId);
    updateDocumentNonBlocking(roomRef, { status, updatedAt: new Date().toISOString() });
    toast({ title: "Status updated" });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Housekeeping</h1>
            <p className="text-muted-foreground mt-1">Real-time room status and cleaning board</p>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Add Physical Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Room</DialogTitle>
                <DialogDescription>Create a physical room record for tracking.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRoom} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input 
                    placeholder="101" 
                    value={newRoom.roomNumber}
                    onChange={(e) => setNewRoom({...newRoom, roomNumber: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input 
                    type="number"
                    value={newRoom.floor}
                    onChange={(e) => setNewRoom({...newRoom, floor: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newRoom.type} onValueChange={(val) => setNewRoom({...newRoom, type: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Deluxe">Deluxe</SelectItem>
                      <SelectItem value="Suite">Suite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Create Room</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rooms && rooms.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {rooms.map((room) => {
              const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
              return (
                <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className={cn("h-2", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold tracking-tight">Room {room.roomNumber}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Floor {room.floor}</span>
                    </div>
                    <Select onValueChange={(val) => updateStatus(room.id, val)} value={room.status}>
                      <SelectTrigger className="w-8 h-8 p-0 border-none shadow-none focus:ring-0">
                        <MoreVertical className="w-4 h-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Mark Clean</SelectItem>
                        <SelectItem value="cleaning">Start Cleaning</SelectItem>
                        <SelectItem value="occupied">Set Occupied</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="p-4 pt-4 space-y-4">
                    <div className={cn("flex items-center gap-2 p-2 rounded-lg", config.bg)}>
                      <config.icon className={cn("w-4 h-4", config.color)} />
                      <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0">
                        {room.roomTypeId}
                      </Badge>
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-secondary border-2 border-white flex items-center justify-center text-[10px] text-muted-foreground font-bold">--</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
            <h3 className="text-lg font-semibold">No rooms added yet</h3>
            <p className="text-muted-foreground">Start by adding the physical rooms in your property.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

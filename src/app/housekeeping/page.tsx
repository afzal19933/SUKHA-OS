
"use client";

import { useState, useMemo } from "react";
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
  Plus,
  UserCheck,
  AlertTriangle,
  DoorOpen,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
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
  occupied: { icon: Clock, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Needs Cleaning" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
};

export default function HousekeepingPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [assignment, setAssignment] = useState({ staffId: "", priority: "medium" });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", type: "Standard" });

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const teamQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "user_profiles"), 
      where("entityId", "==", entityId),
      where("role", "in", ["staff", "housekeeping", "frontdesk"])
    );
  }, [db, entityId]);

  const tasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      where("status", "!=", "completed")
    );
  }, [db, entityId]);

  const { data: rooms, isLoading } = useCollection(roomsQuery);
  const { data: staffMembers } = useCollection(teamQuery);
  const { data: activeTasks } = useCollection(tasksQuery);

  const stats = useMemo(() => {
    if (!rooms) return { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0 };
    return rooms.reduce((acc: any, room: any) => {
      acc.total++;
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0 });
  }, [rooms]);

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
    toast({ title: "Room added" });
    setIsAddOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", type: "Standard" });
  };

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !selectedRoom) return;

    const staff = staffMembers?.find(s => s.id === assignment.staffId);
    
    const tasksRef = collection(db, "hotel_properties", entityId, "housekeeping_tasks");
    addDocumentNonBlocking(tasksRef, {
      entityId,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.roomNumber,
      taskType: "routine_cleaning",
      assignedStaffId: assignment.staffId,
      assignedStaffName: staff?.name || "Unknown",
      status: "in_progress",
      priority: assignment.priority,
      dueTime: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const roomRef = doc(db, "hotel_properties", entityId, "rooms", selectedRoom.id);
    updateDocumentNonBlocking(roomRef, { 
      status: "cleaning", 
      updatedAt: new Date().toISOString() 
    });

    toast({ title: "Task Assigned", description: `Assigned to ${staff?.name}` });
    setIsAssignOpen(false);
    setSelectedRoom(null);
    setAssignment({ staffId: "", priority: "medium" });
  };

  const updateStatus = (room: any, status: string) => {
    if (!entityId) return;
    
    if (status === "cleaning") {
      setSelectedRoom(room);
      setIsAssignOpen(true);
      return;
    }

    const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
    updateDocumentNonBlocking(roomRef, { status, updatedAt: new Date().toISOString() });
    
    if (status === "available") {
      const task = activeTasks?.find(t => t.roomId === room.id && t.taskType === "routine_cleaning");
      if (task) {
        const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
        updateDocumentNonBlocking(taskRef, { status: "completed", updatedAt: new Date().toISOString() });
      }
    }
    
    toast({ title: "Status updated" });
  };

  const isSupervisorOrAdmin = ["owner", "admin", "manager", "supervisor"].includes(currentUserRole || "");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time room status and cleaning operations</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isSupervisorOrAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-9 text-xs">
                    <Plus className="w-4 h-4 mr-2" />
                    New Physical Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Room</DialogTitle>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <DoorOpen className="w-4 h-4 text-muted-foreground mb-1.5" />
              <span className="text-xl font-bold">{stats.total}</span>
              <span className="text-[9px] uppercase font-bold text-muted-foreground">Total</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <ShieldCheck className="w-4 h-4 text-emerald-500 mb-1.5" />
              <span className="text-xl font-bold text-emerald-600">{stats.available}</span>
              <span className="text-[9px] uppercase font-bold text-emerald-500">Clean</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-4 h-4 text-orange-500 mb-1.5" />
              <span className="text-xl font-bold text-orange-600">{stats.dirty}</span>
              <span className="text-[9px] uppercase font-bold text-orange-500">Dirty</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <Brush className="w-4 h-4 text-primary mb-1.5" />
              <span className="text-xl font-bold text-primary">{stats.cleaning}</span>
              <span className="text-[9px] uppercase font-bold text-primary">Cleaning</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <Clock className="w-4 h-4 text-blue-500 mb-1.5" />
              <span className="text-xl font-bold text-blue-600">{stats.occupied}</span>
              <span className="text-[9px] uppercase font-bold text-blue-500">Occupied</span>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-4 h-4 text-rose-500 mb-1.5" />
              <span className="text-xl font-bold text-rose-600">{stats.maintenance}</span>
              <span className="text-[9px] uppercase font-bold text-rose-500">Repair</span>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : rooms && rooms.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {rooms.sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map((room) => {
              const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
              const activeTask = activeTasks?.find(t => t.roomId === room.id);
              
              return (
                <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
                  <div className={cn("h-1", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                  <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold tracking-tight">Room {room.roomNumber}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Floor {room.floor}</span>
                    </div>
                    {isSupervisorOrAdmin && (
                      <Select onValueChange={(val) => updateStatus(room, val)} value={room.status}>
                        <SelectTrigger className="w-7 h-7 p-0 border-none shadow-none focus:ring-0">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Clean / Ready</SelectItem>
                          <SelectItem value="dirty">Mark Dirty</SelectItem>
                          <SelectItem value="cleaning">Start Cleaning</SelectItem>
                          <SelectItem value="occupied">Set Occupied</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </CardHeader>
                  <CardContent className="p-3 pt-3 space-y-3">
                    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg", config.bg)}>
                      <config.icon className={cn("w-3.5 h-3.5", config.color)} />
                      <span className={cn("text-[10px] font-bold uppercase", config.color)}>{config.label}</span>
                    </div>
                    
                    {activeTask && room.status === 'cleaning' ? (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/30 p-1.5 rounded-md border border-secondary">
                        <UserCheck className="w-3 h-3 text-primary" />
                        <span className="truncate font-medium">{activeTask.assignedStaffName}</span>
                      </div>
                    ) : (
                      <div className="h-[25px]" />
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t">
                      <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 bg-secondary/20">
                        {room.roomTypeId}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <History className="w-2.5 h-2.5" />
                        {room.updatedAt ? new Date(room.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed flex flex-col items-center">
            <DoorOpen className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <h3 className="text-base font-semibold">No rooms configured</h3>
            <p className="text-sm text-muted-foreground">Add physical rooms to start tracking housekeeping.</p>
          </div>
        )}

        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Cleaning Task</DialogTitle>
              <DialogDescription>
                Assign Room {selectedRoom?.roomNumber} to a staff member for cleaning.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignTask} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Select Staff Member</Label>
                <Select 
                  value={assignment.staffId} 
                  onValueChange={(val) => setAssignment({...assignment, staffId: val})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers?.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                    {(!staffMembers || staffMembers.length === 0) && (
                      <SelectItem value="none" disabled>No staff available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={assignment.priority} 
                  onValueChange={(val) => setAssignment({...assignment, priority: val})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High (Urgent)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full">Confirm Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

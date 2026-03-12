
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
  Plus,
  UserCheck
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
  occupied: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied" },
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
    // CRITICAL: Supervisors and Admins/Managers/Owners are excluded from being assigned cleaning tasks
    return query(
      collection(db, "user_profiles"), 
      where("entityId", "==", entityId),
      where("role", "in", ["staff", "housekeeping", "frontdesk"]) // Exclude supervisor, manager, admin, owner
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
    
    // Create the task
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
      dueTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update room status
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
    
    // If marking as available, complete any active cleaning tasks for this room
    if (status === "available") {
      const task = activeTasks?.find(t => t.roomId === room.id && t.taskType === "routine_cleaning");
      if (task) {
        const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
        updateDocumentNonBlocking(taskRef, { status: "completed", updatedAt: new Date().toISOString() });
      }
    }
    
    toast({ title: "Status updated" });
  };

  // Supervisors and higher can manage rooms and assign tasks
  const isSupervisorOrAdmin = ["owner", "admin", "manager", "supervisor"].includes(currentUserRole || "");

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Housekeeping</h1>
            <p className="text-muted-foreground mt-1">Room status and task board</p>
          </div>
          
          {isSupervisorOrAdmin && (
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

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : rooms && rooms.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {rooms.map((room) => {
              const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
              const activeTask = activeTasks?.find(t => t.roomId === room.id);
              
              return (
                <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className={cn("h-1.5", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold tracking-tight">Room {room.roomNumber}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Floor {room.floor}</span>
                    </div>
                    {isSupervisorOrAdmin && (
                      <Select onValueChange={(val) => updateStatus(room, val)} value={room.status}>
                        <SelectTrigger className="w-8 h-8 p-0 border-none shadow-none focus:ring-0">
                          <MoreVertical className="w-4 h-4" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Mark Clean</SelectItem>
                          <SelectItem value="cleaning">Assign Cleaning</SelectItem>
                          <SelectItem value="occupied">Set Occupied</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-4 space-y-4">
                    <div className={cn("flex items-center gap-2 p-2 rounded-lg", config.bg)}>
                      <config.icon className={cn("w-4 h-4", config.color)} />
                      <span className={cn("text-[11px] font-bold uppercase", config.color)}>{config.label}</span>
                    </div>
                    
                    {activeTask && room.status === 'cleaning' && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="truncate">{activeTask.assignedStaffName}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0">
                        {room.roomTypeId}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
            <h3 className="text-lg font-semibold">No rooms found</h3>
            <p className="text-muted-foreground">Add physical rooms to start tracking housekeeping.</p>
          </div>
        )}

        {/* Assignment Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Cleaning Task</DialogTitle>
              <DialogDescription>
                Assign Room {selectedRoom?.roomNumber} to a staff member.
                Note: Supervisors and Admins cannot be assigned cleaning tasks.
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
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full">Confirm Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

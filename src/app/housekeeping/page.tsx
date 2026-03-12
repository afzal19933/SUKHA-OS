
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
  History,
  FilterX
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
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Vacant Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning (Vac)" },
  occupied: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied (Ready)" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Vacant Dirty" },
  occupied_dirty: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied (Dirty)" },
  occupied_cleaning: { icon: Brush, color: "text-indigo-500", bg: "bg-indigo-50", label: "Cleaning (Occ)" },
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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
    if (!rooms) return { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0, occupied_dirty: 0, occupied_cleaning: 0 };
    return rooms.reduce((acc: any, room: any) => {
      acc.total++;
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0, occupied_dirty: 0, occupied_cleaning: 0 });
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (!activeFilter) return [...rooms].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
    return rooms.filter(r => r.status === activeFilter).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, activeFilter]);

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
    const newStatus = selectedRoom.status === 'occupied_dirty' ? 'occupied_cleaning' : 'cleaning';
    
    const tasksRef = collection(db, "hotel_properties", entityId, "housekeeping_tasks");
    addDocumentNonBlocking(tasksRef, {
      entityId,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.roomNumber,
      taskType: selectedRoom.status.includes('occupied') ? "stayover_cleaning" : "routine_cleaning",
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
      status: newStatus, 
      updatedAt: new Date().toISOString() 
    });

    toast({ title: "Task Assigned", description: `Assigned to ${staff?.name}` });
    setIsAssignOpen(false);
    setSelectedRoom(null);
    setAssignment({ staffId: "", priority: "medium" });
  };

  const updateStatus = (room: any, status: string) => {
    if (!entityId) return;
    
    if (status === "cleaning" || status === "occupied_cleaning") {
      setSelectedRoom(room);
      setIsAssignOpen(true);
      return;
    }

    const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
    updateDocumentNonBlocking(roomRef, { status, updatedAt: new Date().toISOString() });
    
    if (status === "available" || status === "occupied") {
      const task = activeTasks?.find(t => t.roomId === room.id);
      if (task) {
        const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
        updateDocumentNonBlocking(taskRef, { status: "completed", updatedAt: new Date().toISOString() });
      }
    }
    
    toast({ title: "Status updated" });
  };

  const isSupervisorOrAdmin = ["owner", "admin", "manager", "supervisor"].includes(currentUserRole || "");

  const StatCard = ({ id, label, value, icon: Icon, colorClass, active }: any) => (
    <Card 
      className={cn(
        "border-none shadow-sm cursor-pointer transition-all hover:scale-[1.02]",
        active ? "ring-2 ring-primary bg-primary/5 shadow-md" : "bg-white"
      )}
      onClick={() => setActiveFilter(active ? null : id)}
    >
      <CardContent className="p-3 flex flex-col items-center justify-center text-center">
        <Icon className={cn("w-4 h-4 mb-1.5", colorClass)} />
        <span className={cn("text-xl font-bold", colorClass)}>{value}</span>
        <span className="text-[8px] uppercase font-bold text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Housekeeping Operations</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage room cleanliness and stay-over service</p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeFilter && (
              <Button variant="ghost" size="sm" onClick={() => setActiveFilter(null)} className="h-8 text-[10px] text-rose-500">
                <FilterX className="w-3.5 h-3.5 mr-1" /> Clear Filter
              </Button>
            )}
            {isSupervisorOrAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-8 text-[10px]">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> New Physical Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Room</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddRoom} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Room Number</Label>
                      <Input placeholder="101" value={newRoom.roomNumber} onChange={(e) => setNewRoom({...newRoom, roomNumber: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Floor</Label>
                      <Input type="number" value={newRoom.floor} onChange={(e) => setNewRoom({...newRoom, floor: e.target.value})} required />
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

        <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <Card 
            className={cn(
              "border-none shadow-sm cursor-pointer",
              !activeFilter ? "ring-2 ring-primary/20 bg-secondary/50" : "bg-white"
            )}
            onClick={() => setActiveFilter(null)}
          >
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <DoorOpen className="w-4 h-4 text-muted-foreground mb-1.5" />
              <span className="text-xl font-bold">{stats.total}</span>
              <span className="text-[8px] uppercase font-bold text-muted-foreground">Total Rooms</span>
            </CardContent>
          </Card>
          <StatCard id="available" label="Vacant Ready" value={stats.available} icon={ShieldCheck} colorClass="text-emerald-500" active={activeFilter === 'available'} />
          <StatCard id="dirty" label="Vacant Dirty" value={stats.dirty} icon={AlertTriangle} colorClass="text-orange-500" active={activeFilter === 'dirty'} />
          <StatCard id="cleaning" label="Cleaning (Vac)" value={stats.cleaning} icon={Brush} colorClass="text-primary" active={activeFilter === 'cleaning'} />
          <StatCard id="occupied" label="Occupied (Ready)" value={stats.occupied} icon={CheckCircle2} colorClass="text-blue-500" active={activeFilter === 'occupied'} />
          <StatCard id="occupied_dirty" label="Occupied (Dirty)" value={stats.occupied_dirty} icon={AlertCircle} colorClass="text-amber-500" active={activeFilter === 'occupied_dirty'} />
          <StatCard id="occupied_cleaning" label="Cleaning (Occ)" value={stats.occupied_cleaning} icon={Brush} colorClass="text-indigo-500" active={activeFilter === 'occupied_cleaning'} />
          <StatCard id="maintenance" label="Maint/Rep" value={stats.maintenance} icon={AlertCircle} colorClass="text-rose-500" active={activeFilter === 'maintenance'} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredRooms.map((room) => {
              const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
              const activeTask = activeTasks?.find(t => t.roomId === room.id);
              
              return (
                <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
                  <div className={cn("h-1", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                  <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col">
                      <span className="text-base font-bold tracking-tight">Room {room.roomNumber}</span>
                      <span className="text-[8px] text-muted-foreground uppercase font-bold">Floor {room.floor}</span>
                    </div>
                    {isSupervisorOrAdmin && (
                      <Select onValueChange={(val) => updateStatus(room, val)} value={room.status}>
                        <SelectTrigger className="w-6 h-6 p-0 border-none shadow-none focus:ring-0">
                          <MoreVertical className="w-3 h-3" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Vacant Ready</SelectItem>
                          <SelectItem value="dirty">Vacant Dirty</SelectItem>
                          <SelectItem value="cleaning">Start Cleaning (Vac)</SelectItem>
                          <SelectItem value="occupied">Occupied (Ready)</SelectItem>
                          <SelectItem value="occupied_dirty">Occupied (Dirty)</SelectItem>
                          <SelectItem value="occupied_cleaning">Start Cleaning (Occ)</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </CardHeader>
                  <CardContent className="p-3 pt-3 space-y-2.5">
                    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg", config.bg)}>
                      <config.icon className={cn("w-3 h-3", config.color)} />
                      <span className={cn("text-[9px] font-bold uppercase", config.color)}>{config.label}</span>
                    </div>
                    
                    {activeTask && (room.status === 'cleaning' || room.status === 'occupied_cleaning') ? (
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground bg-secondary/30 p-1.5 rounded-md border border-secondary">
                        <UserCheck className="w-2.5 h-2.5 text-primary" />
                        <span className="truncate font-medium">{activeTask.assignedStaffName}</span>
                      </div>
                    ) : (
                      <div className="h-[23px]" />
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t">
                      <Badge variant="outline" className="text-[8px] uppercase px-1.5 py-0 bg-secondary/20">
                        {room.roomTypeId}
                      </Badge>
                      <span className="text-[8px] text-muted-foreground flex items-center gap-1">
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
            <FilterX className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <h3 className="text-sm font-semibold">No rooms match filter</h3>
            <p className="text-xs text-muted-foreground">Select another status or clear filter to see all rooms.</p>
            <Button variant="link" onClick={() => setActiveFilter(null)} className="text-xs text-primary mt-2">Clear all filters</Button>
          </div>
        )}

        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Cleaning Task</DialogTitle>
              <DialogDescription>
                Assign Room {selectedRoom?.roomNumber} to a staff member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignTask} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Select Staff Member</Label>
                <Select value={assignment.staffId} onValueChange={(val) => setAssignment({...assignment, staffId: val})} required>
                  <SelectTrigger><SelectValue placeholder="Choose staff..." /></SelectTrigger>
                  <SelectContent>
                    {staffMembers?.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name} ({member.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={assignment.priority} onValueChange={(val) => setAssignment({...assignment, priority: val})}>
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

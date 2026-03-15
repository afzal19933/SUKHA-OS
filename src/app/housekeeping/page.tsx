
"use client";

import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Brush, 
  ShieldCheck,
  MoreVertical,
  Loader2,
  UserCheck,
  AlertTriangle,
  DoorOpen,
  History,
  FilterX,
  Building2,
  Calendar,
  ClipboardList,
  XCircle,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where, orderBy, limit } from "firebase/firestore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_CONFIG: any = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Vacant Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning Vacant" },
  occupied: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied Clean" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Vacant Dirty" },
  occupied_dirty: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied Dirty" },
  occupied_cleaning: { icon: Brush, color: "text-indigo-500", bg: "bg-indigo-50", label: "Cleaning Occupied" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
  skipped: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", label: "Cleaning Skipped" },
};

const COMMON_AREAS = [
  "Front Area", "Cafeteria", "OP Area", "Reception", "Lobby", 
  "Walkways - Floor 1", "Walkways - Floor 2", "Walkways - Floor 3", 
  "Lift", "Stairs - Front", "Stairs - Rear", "Gym", "Prayer Room", 
  "Swimming Pool", "Pool Area", "Guest Bathroom - Male", 
  "Guest Bathroom - Female", "Guest Bathroom - Handicapped", 
  "Staff Bathrooms", "Generator", "Treatment Area", "Kitchen", 
  "Solar Panel", "Housekeeping Room"
];

const SKIP_REASONS = [
  "Guest not available",
  "Guest requested postponement",
  "Staff shortage",
  "Do Not Disturb (DND) active",
  "Access denied by guest",
  "Late checkout pending"
];

export default function HousekeepingPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [roomToSkip, setRoomToSkip] = useState<any>(null);
  const [selectedSkipReason, setSelectedSkipReason] = useState("");

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canAssignTasks = ["owner", "admin", "manager", "supervisor", "staff", "frontdesk"].includes(currentUserRole || "");

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "rooms");
  }, [db, entityId]);

  const tasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      where("status", "in", ["pending", "in_progress"])
    );
  }, [db, entityId]);
  
  const historyQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      where("status", "in", ["completed", "skipped"]),
      orderBy("updatedAt", "desc"),
      limit(50)
    );
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: rooms, isLoading } = useCollection(roomsQuery);
  const { data: activeTasks } = useCollection(tasksQuery);
  const { data: taskHistory } = useCollection(historyQuery);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

  useEffect(() => {
    if (!entityId || !rooms || !canAssignTasks) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    rooms.forEach((room: any) => {
      // Auto-mark occupied as dirty if not updated today
      if (room.status === 'occupied' && room.updatedAt) {
        const lastUpdate = new Date(room.updatedAt).toISOString().split('T')[0];
        if (lastUpdate < today) {
          const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
          updateDocumentNonBlocking(roomRef, { 
            status: 'occupied_dirty', 
            updatedAt: new Date().toISOString() 
          });
        }
      }
    });
  }, [rooms, entityId, db, canAssignTasks]);

  const stats = useMemo(() => {
    if (!rooms) return { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0, occupied_dirty: 0, occupied_cleaning: 0, skipped: 0 };
    return rooms.reduce((acc: any, room: any) => {
      acc.total++;
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, { total: 0, available: 0, cleaning: 0, occupied: 0, dirty: 0, maintenance: 0, occupied_dirty: 0, occupied_cleaning: 0, skipped: 0 });
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (!activeFilter) return [...rooms].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
    return rooms.filter(r => r.status === activeFilter).sort((a,b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, activeFilter]);

  const updateStatus = (room: any, status: string) => {
    if (!entityId || !canAssignTasks) return;
    
    if (status === "skipped_trigger") {
      setRoomToSkip(room);
      setSkipDialogOpen(true);
      return;
    }

    const roomRef = doc(db, "hotel_properties", entityId, "rooms", room.id);
    updateDocumentNonBlocking(roomRef, { status, updatedAt: new Date().toISOString() });
    
    // Automation: Log task completion
    if (status === "available" || status === "occupied") {
      const task = activeTasks?.find(t => t.roomId === room.id);
      if (task) {
        const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
        updateDocumentNonBlocking(taskRef, { 
          status: "completed", 
          updatedAt: new Date().toISOString(),
          completedBy: user?.displayName || "Staff"
        });
      }
    }

    // Automation: Start cleaning task tracking
    if (status === "cleaning" || status === "occupied_cleaning") {
      const existingTask = activeTasks?.find(t => t.roomId === room.id);
      if (!existingTask) {
        addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "housekeeping_tasks"), {
          entityId,
          roomId: room.id,
          roomNumber: room.roomNumber,
          isCommonArea: false,
          taskType: "cleaning",
          status: "in_progress",
          assignedStaffName: user?.displayName || "Housekeeping Staff",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    toast({ title: "Status updated" });
  };

  const handleSkipConfirm = () => {
    if (!entityId || !roomToSkip || !selectedSkipReason) return;

    // 1. Update room status to 'skipped'
    const roomRef = doc(db, "hotel_properties", entityId, "rooms", roomToSkip.id);
    updateDocumentNonBlocking(roomRef, { 
      status: 'skipped', 
      updatedAt: new Date().toISOString() 
    });

    // 2. Log the skip event
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "housekeeping_tasks"), {
      entityId,
      roomId: roomToSkip.id,
      roomNumber: roomToSkip.roomNumber,
      isCommonArea: false,
      taskType: "cleaning_exception",
      status: "skipped",
      notes: selectedSkipReason,
      completedBy: user?.displayName || "Staff",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Close and reset
    setSkipDialogOpen(false);
    setRoomToSkip(null);
    setSelectedSkipReason("");
    toast({ title: "Cleaning Skip Recorded", description: `Room ${roomToSkip.roomNumber} marked as skipped.` });
  };

  const completeAreaTask = (areaName: string) => {
    if (!entityId || !canAssignTasks) return;
    const task = activeTasks?.find(t => t.roomId === areaName && t.isCommonArea);
    if (task) {
      const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
      updateDocumentNonBlocking(taskRef, { 
        status: "completed", 
        updatedAt: new Date().toISOString(),
        completedBy: user?.displayName || "Staff"
      });
      toast({ title: "Task Completed" });
    }
  };

  const roomCleaningLogs = useMemo(() => {
    return taskHistory?.filter(t => !t.isCommonArea && (t.taskType === 'cleaning' || t.taskType === 'cleaning_exception')) || [];
  }, [taskHistory]);

  const StatCard = ({ id, label, value, icon: Icon, colorClass, active }: any) => (
    <Card 
      className={cn(
        "border-none shadow-sm cursor-pointer transition-all hover:scale-[1.01]",
        active ? "ring-2 ring-primary bg-primary/5 shadow-md" : "bg-white"
      )}
      onClick={() => setActiveFilter(active ? null : id)}
    >
      <CardContent className="p-2.5 flex flex-col items-center justify-center text-center">
        <Icon className={cn("w-4 h-4 mb-1", colorClass)} />
        <span className={cn("text-xl font-bold", colorClass)}>{value}</span>
        <span className="text-[8.5px] uppercase font-bold text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Housekeeping Control</h1>
            <p className="text-xs text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Real-time Facility Management</p>
          </div>
        </div>

        <Tabs defaultValue="rooms" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="rooms" className="rounded-lg h-7 text-[11px] px-5">Room Units</TabsTrigger>
            <TabsTrigger value="common-areas" className="rounded-lg h-7 text-[11px] px-5">Common Areas</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="space-y-4">
            <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-9 gap-1.5">
              <Card 
                className={cn(
                  "border-none shadow-sm cursor-pointer",
                  !activeFilter ? "ring-2 ring-primary/20 bg-secondary/50" : "bg-white"
                )}
                onClick={() => setActiveFilter(null)}
              >
                <CardContent className="p-2.5 flex flex-col items-center justify-center text-center">
                  <DoorOpen className="w-4 h-4 text-muted-foreground mb-1" />
                  <span className="text-xl font-bold">{stats.total}</span>
                  <span className="text-[8.5px] uppercase font-bold text-muted-foreground">Total Units</span>
                </CardContent>
              </Card>
              <StatCard id="available" label="Vacant Ready" value={stats.available} icon={ShieldCheck} colorClass="text-emerald-500" active={activeFilter === 'available'} />
              <StatCard id="dirty" label="Vacant Dirty" value={stats.dirty} icon={AlertTriangle} colorClass="text-orange-500" active={activeFilter === 'dirty'} />
              <StatCard id="cleaning" label="Cleaning Vacant" value={stats.cleaning} icon={Brush} colorClass="text-primary" active={activeFilter === 'cleaning'} />
              <StatCard id="occupied" label="Occupied Clean" value={stats.occupied} icon={CheckCircle2} colorClass="text-blue-500" active={activeFilter === 'occupied'} />
              <StatCard id="occupied_dirty" label="Occupied Dirty" value={stats.occupied_dirty} icon={AlertCircle} colorClass="text-amber-500" active={activeFilter === 'occupied_dirty'} />
              <StatCard id="occupied_cleaning" label="Cleaning Occupied" value={stats.occupied_cleaning} icon={Brush} colorClass="text-indigo-500" active={activeFilter === 'occupied_cleaning'} />
              <StatCard id="skipped" label="Cleaning Skipped" value={stats.skipped} icon={XCircle} colorClass="text-rose-600" active={activeFilter === 'skipped'} />
              <StatCard id="maintenance" label="Maintenance" value={stats.maintenance} icon={AlertCircle} colorClass="text-rose-500" active={activeFilter === 'maintenance'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : filteredRooms.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredRooms.map((room) => {
                      const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
                      const activeTask = activeTasks?.find(t => t.roomId === room.id);
                      const isOccupied = room.status.includes('occupied') || room.status === 'skipped';
                      
                      return (
                        <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
                          <div className={cn("h-1", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                          <CardHeader className="p-2.5 pb-0 flex flex-row items-center justify-between space-y-0">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold tracking-tight">Room {room.roomNumber}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[8px] text-muted-foreground uppercase font-bold">Floor {room.floor}</span>
                                {isParadise && room.building && (
                                  <Badge variant="outline" className="text-[7px] h-3 px-1 uppercase font-black bg-primary/5 text-primary border-primary/10">
                                    {room.building}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {canAssignTasks && (
                              <Select onValueChange={(val) => updateStatus(room, val)} value={room.status}>
                                <SelectTrigger className="w-5 h-5 p-0 border-none shadow-none focus:ring-0">
                                  <MoreVertical className="w-3 h-3" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="available">Vacant Ready</SelectItem>
                                  <SelectItem value="dirty">Vacant Dirty</SelectItem>
                                  <SelectItem value="cleaning">Start Cleaning Vacant</SelectItem>
                                  <SelectItem value="occupied">Occupied Clean</SelectItem>
                                  <SelectItem value="occupied_dirty">Occupied Dirty</SelectItem>
                                  <SelectItem value="occupied_cleaning">Start Cleaning Occupied</SelectItem>
                                  {isOccupied && <SelectItem value="skipped_trigger" className="text-rose-600 font-bold">Skip Today's Cleaning</SelectItem>}
                                  <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </CardHeader>
                          <CardContent className="p-2.5 pt-2.5 space-y-2">
                            <div className={cn("flex items-center gap-1.5 p-1 rounded-lg", config.bg)}>
                              <config.icon className={cn("w-2.5 h-2.5", config.color)} />
                              <span className={cn("text-[9px] font-bold uppercase", config.color)}>{config.label}</span>
                            </div>
                            
                            {activeTask && (room.status === 'cleaning' || room.status === 'occupied_cleaning') ? (
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary/30 p-1 rounded-md border border-secondary truncate">
                                <UserCheck className="w-2.5 h-2.5 text-primary shrink-0" />
                                <span className="truncate">{activeTask.assignedStaffName}</span>
                              </div>
                            ) : (
                              <div className="h-[18px]" />
                            )}

                            <div className="flex items-center justify-between pt-1 border-t">
                              <Badge variant="outline" className="text-[8px] uppercase px-1 py-0 bg-secondary/20">
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
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed flex flex-col items-center">
                    <FilterX className="w-6 h-6 text-muted-foreground/20 mb-1" />
                    <h3 className="text-xs font-semibold">No matches</h3>
                    <Button variant="link" onClick={() => setActiveFilter(null)} className="text-[11px] text-primary h-auto p-0 mt-1">Clear filters</Button>
                  </div>
                )}
              </div>

              {/* Side Log for Room Cleaning & Exceptions */}
              <div className="space-y-4">
                <Card className="border-none shadow-sm bg-primary/5 h-[calc(100vh-20rem)] flex flex-col overflow-hidden">
                  <CardHeader className="p-4 pb-2 border-b border-primary/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Operational Log
                    </h3>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {roomCleaningLogs.length > 0 ? roomCleaningLogs.map((log) => {
                        const isSkip = log.status === 'skipped';
                        return (
                          <div key={log.id} className={cn(
                            "p-3 rounded-xl border shadow-sm space-y-1 group transition-colors",
                            isSkip ? "bg-rose-50 border-rose-100 hover:border-rose-300" : "bg-white border-primary/10 hover:border-primary/30"
                          )}>
                            <div className="flex justify-between items-start">
                              <span className={cn("text-[11px] font-black", isSkip ? "text-rose-700" : "text-primary")}>
                                Room {log.roomNumber || "N/A"}
                              </span>
                              <Badge variant="outline" className={cn(
                                "text-[7px] h-3.5 px-1 uppercase",
                                isSkip ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                {isSkip ? "Skipped" : "Verified Clean"}
                              </Badge>
                            </div>
                            {isSkip && (
                              <p className="text-[9px] font-black text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> {log.notes}
                              </p>
                            )}
                            <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                              <UserCheck className="w-2.5 h-2.5" /> {log.assignedStaffName || log.completedBy || "System"}
                            </p>
                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-secondary/50">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">{formatAppDate(log.updatedAt)}</span>
                              <span className="text-[8px] font-bold text-muted-foreground">{formatAppTime(log.updatedAt)}</span>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-20 opacity-30 flex flex-col items-center">
                          <History className="w-8 h-8 mb-2" />
                          <p className="text-[9px] font-black uppercase">No recent activity</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="common-areas" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                      {COMMON_AREAS.map((area) => {
                        const activeTask = activeTasks?.find(t => t.roomId === area && t.isCommonArea);
                        const lastCleaned = taskHistory?.find(t => t.roomId === area && t.isCommonArea);

                        return (
                          <div key={area} className="p-3 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl",
                                activeTask ? "bg-amber-50 text-amber-600" : "bg-primary/5 text-primary"
                              )}>
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold">{area}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{lastCleaned ? formatAppDate(lastCleaned.updatedAt) : "Never Cleaned"}</span>
                                  </div>
                                  {activeTask && (
                                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-amber-50 text-amber-600 border-amber-100">
                                      {activeTask.assignedStaffName}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {activeTask ? (
                                <Button size="sm" variant="outline" className="h-7 text-[11px] font-bold text-emerald-600" onClick={() => completeAreaTask(area)}>
                                  Mark Ready
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-[11px] font-bold text-primary">
                                  Assign
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="space-y-3">
                <Card className="border-none shadow-sm bg-primary/5">
                  <CardHeader className="p-3 pb-2">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-widest text-primary">
                      <Calendar className="w-3.5 h-3.5" />
                      Area Logs
                    </h3>
                  </CardHeader>
                  <div className="p-3 pt-0">
                    <ScrollArea className="h-[420px]">
                      <div className="space-y-2">
                        {taskHistory?.filter(t => t.isCommonArea).slice(0, 20).map((log) => (
                          <div key={log.id} className="p-2.5 bg-white rounded-lg border border-primary/10 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-bold leading-tight">{log.roomId}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{log.assignedStaffName || log.completedBy}</p>
                              <p className="text-[8px] text-muted-foreground mt-1 uppercase font-bold">{formatAppDate(log.updatedAt)} • {formatAppTime(log.updatedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Skip Cleaning Reason Dialog */}
        <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" /> Cleaning Exception
              </DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase">
                Record the reason for skipping cleaning for Room {roomToSkip?.roomNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Reason</Label>
                <Select value={selectedSkipReason} onValueChange={setSelectedSkipReason}>
                  <SelectTrigger className="h-11 rounded-2xl bg-secondary/30 border-none text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <span>{selectedSkipReason || "Choose a reason..."}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {SKIP_REASONS.map(reason => (
                      <SelectItem key={reason} value={reason} className="text-xs font-bold py-3">{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setSkipDialogOpen(false)} className="rounded-xl text-[10px] font-black uppercase">Cancel</Button>
              <Button 
                onClick={handleSkipConfirm} 
                disabled={!selectedSkipReason}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-200 text-[10px] font-black uppercase tracking-widest px-6"
              >
                Log Exception
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

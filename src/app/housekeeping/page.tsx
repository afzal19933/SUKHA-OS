
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
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { sendNotification } from "@/firebase/notifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_CONFIG: any = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Vacant Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning (Vac)" },
  occupied: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50", label: "Occupied Clean" },
  dirty: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Vacant Dirty" },
  occupied_dirty: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied Dirty" },
  occupied_cleaning: { icon: Brush, color: "text-indigo-500", bg: "bg-indigo-50", label: "Cleaning (Occ)" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
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

export default function HousekeepingPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
      where("status", "==", "completed")
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

  const updateStatus = (room: any, status: string) => {
    if (!entityId || !canAssignTasks) return;
    
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

  const completeAreaTask = (areaName: string) => {
    if (!entityId || !canAssignTasks) return;
    const task = activeTasks?.find(t => t.roomId === areaName && t.isCommonArea);
    if (task) {
      const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
      updateDocumentNonBlocking(taskRef, { status: "completed", updatedAt: new Date().toISOString() });
      toast({ title: "Task Completed" });
    }
  };

  const StatCard = ({ id, label, value, icon: Icon, colorClass, active }: any) => (
    <Card 
      className={cn(
        "border-none shadow-sm cursor-pointer transition-all hover:scale-[1.01]",
        active ? "ring-2 ring-primary bg-primary/5 shadow-md" : "bg-white"
      )}
      onClick={() => setActiveFilter(active ? null : id)}
    >
      <CardContent className="p-2.5 flex flex-col items-center justify-center text-center">
        <Icon className={cn("w-3.5 h-3.5 mb-1", colorClass)} />
        <span className={cn("text-lg font-bold", colorClass)}>{value}</span>
        <span className="text-[7.5px] uppercase font-bold text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Housekeeping</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage room cleanliness and facilities</p>
          </div>
        </div>

        <Tabs defaultValue="rooms" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="rooms" className="rounded-lg h-7 text-[11px] px-5">Rooms</TabsTrigger>
            <TabsTrigger value="common-areas" className="rounded-lg h-7 text-[11px] px-5">Common Areas</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="space-y-4">
            <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-1.5">
              <Card 
                className={cn(
                  "border-none shadow-sm cursor-pointer",
                  !activeFilter ? "ring-2 ring-primary/20 bg-secondary/50" : "bg-white"
                )}
                onClick={() => setActiveFilter(null)}
              >
                <CardContent className="p-2.5 flex flex-col items-center justify-center text-center">
                  <DoorOpen className="w-3.5 h-3.5 text-muted-foreground mb-1" />
                  <span className="text-lg font-bold">{stats.total}</span>
                  <span className="text-[7.5px] uppercase font-bold text-muted-foreground">Total</span>
                </CardContent>
              </Card>
              <StatCard id="available" label="Ready" value={stats.available} icon={ShieldCheck} colorClass="text-emerald-500" active={activeFilter === 'available'} />
              <StatCard id="dirty" label="Dirty" value={stats.dirty} icon={AlertTriangle} colorClass="text-orange-500" active={activeFilter === 'dirty'} />
              <StatCard id="cleaning" label="Cleaning" value={stats.cleaning} icon={Brush} colorClass="text-primary" active={activeFilter === 'cleaning'} />
              <StatCard id="occupied" label="Occ Clean" value={stats.occupied} icon={CheckCircle2} colorClass="text-blue-500" active={activeFilter === 'occupied'} />
              <StatCard id="occupied_dirty" label="Occ Dirty" value={stats.occupied_dirty} icon={AlertCircle} colorClass="text-amber-500" active={activeFilter === 'occupied_dirty'} />
              <StatCard id="occupied_cleaning" label="Occ Clean-in" value={stats.occupied_cleaning} icon={Brush} colorClass="text-indigo-500" active={activeFilter === 'occupied_cleaning'} />
              <StatCard id="maintenance" label="Maint" value={stats.maintenance} icon={AlertCircle} colorClass="text-rose-500" active={activeFilter === 'maintenance'} />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : filteredRooms.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredRooms.map((room) => {
                  const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
                  const activeTask = activeTasks?.find(t => t.roomId === room.id);
                  
                  return (
                    <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
                      <div className={cn("h-1", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                      <CardHeader className="p-2.5 pb-0 flex flex-row items-center justify-between space-y-0">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold tracking-tight">Room {room.roomNumber}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[7px] text-muted-foreground uppercase font-bold">Floor {room.floor}</span>
                            {isParadise && room.building && (
                              <Badge variant="outline" className="text-[6px] h-3 px-1 uppercase font-black bg-primary/5 text-primary border-primary/10">
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
                              <SelectItem value="cleaning">Start Cleaning (Vac)</SelectItem>
                              <SelectItem value="occupied">Occupied Clean</SelectItem>
                              <SelectItem value="occupied_dirty">Occupied Dirty</SelectItem>
                              <SelectItem value="occupied_cleaning">Start Cleaning (Occ)</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </CardHeader>
                      <CardContent className="p-2.5 pt-2.5 space-y-2">
                        <div className={cn("flex items-center gap-1.5 p-1 rounded-lg", config.bg)}>
                          <config.icon className={cn("w-2.5 h-2.5", config.color)} />
                          <span className={cn("text-[8px] font-bold uppercase", config.color)}>{config.label}</span>
                        </div>
                        
                        {activeTask && (room.status === 'cleaning' || room.status === 'occupied_cleaning') ? (
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground bg-secondary/30 p-1 rounded-md border border-secondary truncate">
                            <UserCheck className="w-2 h-2 text-primary shrink-0" />
                            <span className="truncate">{activeTask.assignedStaffName}</span>
                          </div>
                        ) : (
                          <div className="h-[18px]" />
                        )}

                        <div className="flex items-center justify-between pt-1 border-t">
                          <Badge variant="outline" className="text-[7px] uppercase px-1 py-0 bg-secondary/20">
                            {room.roomTypeId}
                          </Badge>
                          <span className="text-[7px] text-muted-foreground flex items-center gap-1">
                            <History className="w-2 h-2" />
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
                <Button variant="link" onClick={() => setActiveFilter(null)} className="text-[10px] text-primary h-auto p-0 mt-1">Clear filters</Button>
              </div>
            )}
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
                                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{lastCleaned ? formatAppDate(lastCleaned.updatedAt) : "Never"}</span>
                                  </div>
                                  {activeTask && (
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-amber-50 text-amber-600 border-amber-100">
                                      {activeTask.assignedStaffName}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {activeTask ? (
                                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-emerald-600" onClick={() => completeAreaTask(area)}>
                                  Complete
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-primary">
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
                    <h3 className="text-xs font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Logs
                    </h3>
                  </CardHeader>
                  <div className="p-3 pt-0">
                    <ScrollArea className="h-[420px]">
                      <div className="space-y-2">
                        {taskHistory?.filter(t => t.isCommonArea).slice(0, 10).map((log) => (
                          <div key={log.id} className="p-2.5 bg-white rounded-lg border border-primary/10 flex items-start gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold leading-tight">{log.roomId}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{log.assignedStaffName}</p>
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
      </div>
    </AppLayout>
  );
}

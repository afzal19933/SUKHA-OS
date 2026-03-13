
"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  MoreVertical,
  Loader2,
  Building2,
  MapPin,
  History,
  Search,
  CheckCircle2,
  CalendarDays,
  CalendarCheck,
  AlertCircle,
  Settings2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, doc, query, orderBy, where, deleteDoc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendNotification } from "@/firebase/notifications";

const COMMON_AREAS = [
  "Front Area", "Cafeteria", "OP Area", "Reception", "Lobby", 
  "Walkways - Floor 1", "Walkways - Floor 2", "Walkways - Floor 3", 
  "Lift", "Stairs - Front", "Stairs - Rear", "Gym", "Prayer Room", 
  "Swimming Pool", "Pool Area", "Guest Bathroom - Male", 
  "Guest Bathroom - Female", "Guest Bathroom - Handicapped", 
  "Staff Bathrooms", "Generator", "Treatment Area", "Kitchen", 
  "Solar Panel", "Housekeeping Room"
];

const FREQUENCIES = [
  { label: "Daily", value: "daily", days: 1 },
  { label: "Weekly", value: "weekly", days: 7 },
  { label: "Monthly", value: "monthly", days: 30 },
  { label: "Quarterly", value: "quarterly", days: 90 },
  { label: "Bi-Annually", value: "bi-annually", days: 180 },
  { label: "Yearly", value: "yearly", days: 365 }
];

export default function MaintenancePage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canUpdateStatus = ["owner", "admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  
  const [newTask, setNewTask] = useState({ 
    areaType: "room", 
    roomNumber: "", 
    commonArea: COMMON_AREAS[0],
    issue: "", 
    priority: "medium" 
  });

  const [newSchedule, setNewSchedule] = useState({
    itemName: "",
    frequency: "monthly",
    nextDue: new Date().toISOString().split('T')[0],
    notes: ""
  });

  // Queries
  const allTasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "housekeeping_tasks");
  }, [db, entityId]);

  const schedulesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "maintenance_schedules"), orderBy("nextDue", "asc"));
  }, [db, entityId]);

  const { data: allTasks, isLoading } = useCollection(allTasksQuery);
  const { data: schedules, isLoading: schedLoading } = useCollection(schedulesQuery);

  const activeTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks
      .filter(t => t.taskType === "repair" && t.status !== "completed")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [allTasks]);

  const historyTasks = useMemo(() => {
    if (!allTasks) return [];
    const filtered = allTasks
      .filter(t => t.taskType === "repair" && t.status === "completed")
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    if (!historySearch) return filtered;
    const search = historySearch.toLowerCase();
    return filtered.filter(t => 
      (t.roomId || "").toLowerCase().includes(search) || 
      (t.notes || "").toLowerCase().includes(search)
    );
  }, [allTasks, historySearch]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !user) return;

    const taskRef = collection(db, "hotel_properties", entityId, "housekeeping_tasks");
    const targetArea = newTask.areaType === "room" ? `Room ${newTask.roomNumber}` : newTask.commonArea;
    
    addDocumentNonBlocking(taskRef, {
      entityId,
      roomId: newTask.areaType === "room" ? newTask.roomNumber : newTask.commonArea,
      isCommonArea: newTask.areaType === "common_area",
      taskType: "repair",
      notes: newTask.issue,
      priority: newTask.priority,
      status: "pending",
      requestedBy: user.displayName || "Admin",
      dueTime: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    sendNotification(db, user.uid, entityId, {
      title: "Maintenance Requested",
      message: `Repair for ${targetArea}: ${newTask.issue}`,
      type: "alert"
    });

    toast({ title: "Work Order Created" });
    setIsAddOpen(false);
    setNewTask({ areaType: "room", roomNumber: "", commonArea: COMMON_AREAS[0], issue: "", priority: "medium" });
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "maintenance_schedules"), {
      ...newSchedule,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    toast({ title: "Routine Schedule Added" });
    setIsScheduleOpen(false);
    setNewSchedule({ itemName: "", frequency: "monthly", nextDue: new Date().toISOString().split('T')[0], notes: "" });
  };

  const completeRoutine = (schedule: any) => {
    if (!entityId || !canUpdateStatus) return;

    const freq = FREQUENCIES.find(f => f.value === schedule.frequency);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (freq?.days || 30));

    const schedRef = doc(db, "hotel_properties", entityId, "maintenance_schedules", schedule.id);
    updateDocumentNonBlocking(schedRef, {
      lastDone: new Date().toISOString().split('T')[0],
      nextDue: nextDate.toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    });

    // Also log in history
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "housekeeping_tasks"), {
      entityId,
      roomId: schedule.itemName,
      isCommonArea: true,
      taskType: "routine_maintenance",
      notes: `Routine ${schedule.frequency} service completed.`,
      status: "completed",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      completedBy: user?.displayName || "Staff"
    });

    toast({ title: "Routine Task Completed" });
  };

  const deleteSchedule = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "maintenance_schedules", id));
    toast({ title: "Schedule Deleted" });
  };

  const updateStatus = (task: any, status: string) => {
    if (!entityId || !canUpdateStatus || !user) return;
    const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
    
    const updateData: any = { status, updatedAt: new Date().toISOString() };
    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      updateData.completedBy = user.displayName || "Staff";
    }

    updateDocumentNonBlocking(taskRef, updateData);
    toast({ title: `Updated` });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Maintenance</h1>
            <p className="text-muted-foreground text-[10px] mt-0.5 uppercase font-bold">Repairs & Routine Property Care</p>
          </div>
          
          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold">
                    <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                    Routine Setup
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[360px]">
                  <DialogHeader><DialogTitle className="text-sm">Schedule Routine Task</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddSchedule} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Asset / Item Name</Label>
                      <Input placeholder="e.g. Lobby AC Unit" value={newSchedule.itemName} onChange={e => setNewSchedule({...newSchedule, itemName: e.target.value})} required className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Frequency</Label>
                        <Select value={newSchedule.frequency} onValueChange={v => setNewSchedule({...newSchedule, frequency: v})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">First Due</Label>
                        <Input type="date" value={newSchedule.nextDue} onChange={e => setNewSchedule({...newSchedule, nextDue: e.target.value})} required className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Notes</Label>
                      <Input placeholder="Service requirements..." value={newSchedule.notes} onChange={e => setNewSchedule({...newSchedule, notes: e.target.value})} className="h-8 text-xs" />
                    </div>
                    <Button type="submit" className="w-full h-8 text-[10px] font-bold">Save Schedule</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 text-[10px] font-bold shadow-md">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Repair Request
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[360px]">
                  <DialogHeader><DialogTitle className="text-sm">New Repair Order</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddTask} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Location Type</Label>
                      <Tabs value={newTask.areaType} onValueChange={(v) => setNewTask({...newTask, areaType: v})} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 h-7">
                          <TabsTrigger value="room" className="text-[9px] h-5">Room</TabsTrigger>
                          <TabsTrigger value="common_area" className="text-[9px] h-5">Common</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    {newTask.areaType === "room" ? (
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Room #</Label>
                        <Input placeholder="101" value={newTask.roomNumber} onChange={e => setNewTask({...newTask, roomNumber: e.target.value})} required className="h-8 text-xs" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Common Area</Label>
                        <Select value={newTask.commonArea} onValueChange={(v) => setNewTask({...newTask, commonArea: v})}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMMON_AREAS.map(area => <SelectItem key={area} value={area} className="text-xs">{area}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Issue</Label>
                      <Input placeholder="Describe problem..." value={newTask.issue} onChange={e => setNewTask({...newTask, issue: e.target.value})} required className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase font-bold">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(val) => setNewTask({...newTask, priority: val})}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high" className="text-xs">High</SelectItem>
                          <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                          <SelectItem value="low" className="text-xs">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full h-8 text-[10px] font-bold">Submit Work Order</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="active" className="rounded-lg h-7 px-4 text-[10px] font-bold">Active Repairs</TabsTrigger>
            <TabsTrigger value="routine" className="rounded-lg h-7 px-4 text-[10px] font-bold">Routine Maintenance</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg h-7 px-4 text-[10px] font-bold">Log History</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : activeTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeTasks.map((task) => (
                  <Card key={task.id} className="border-none shadow-sm bg-white overflow-hidden relative">
                    <div className={cn("absolute top-0 left-0 w-1 h-full", task.priority === "high" ? "bg-rose-500" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500")} />
                    <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between">
                      <div className="space-y-1">
                        <Badge className={cn("text-[7px] uppercase px-1.5 h-3.5", task.priority === "high" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100")} variant="outline">
                          {task.priority}
                        </Badge>
                        <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                          {task.isCommonArea ? <Building2 className="w-3 h-3 text-primary" /> : <MapPin className="w-3 h-3 text-primary" />}
                          {task.isCommonArea ? task.roomId : `Room ${task.roomId}`}
                        </CardTitle>
                      </div>
                      {canUpdateStatus && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(task, "in_progress")} className="text-[10px]">Mark In-Progress</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(task, "completed")} className="text-[10px] text-emerald-600 font-bold">Resolve Task</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 pt-1.5 space-y-2">
                      <div className="p-2 bg-secondary/30 rounded-lg text-[10px] font-medium leading-tight">
                        {task.notes || "No additional details."}
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t text-[8px] font-bold text-muted-foreground uppercase">
                        <span>{formatAppDate(task.createdAt)}</span>
                        <span>{task.requestedBy}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-[10px] text-muted-foreground font-bold uppercase">No pending repairs</div>
            )}
          </TabsContent>

          <TabsContent value="routine" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {schedLoading ? (
                <div className="col-span-2 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : schedules?.length ? (
                schedules.map(sched => {
                  const isOverdue = new Date(sched.nextDue) < new Date();
                  return (
                    <Card key={sched.id} className="border-none shadow-sm bg-white hover:bg-secondary/5 transition-colors">
                      <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
                        <div>
                          <h4 className="text-[11px] font-bold">{sched.itemName}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[8px] h-3.5 px-1 uppercase">{sched.frequency}</Badge>
                            {isOverdue && <Badge className="bg-rose-50 text-rose-600 border-rose-100 text-[8px] h-3.5 px-1 uppercase">Overdue</Badge>}
                          </div>
                        </div>
                        {canUpdateStatus && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => completeRoutine(sched)} className="text-[10px] font-bold text-emerald-600">Mark Completed</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteSchedule(sched.id)} className="text-[10px] text-destructive">Remove Schedule</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="bg-secondary/30 p-1.5 rounded-lg text-center">
                            <p className="text-[7px] uppercase font-bold text-muted-foreground">Last Serviced</p>
                            <p className="text-[9px] font-bold">{sched.lastDone ? formatAppDate(sched.lastDone) : "Never"}</p>
                          </div>
                          <div className={cn("p-1.5 rounded-lg text-center", isOverdue ? "bg-rose-50" : "bg-emerald-50")}>
                            <p className="text-[7px] uppercase font-bold text-muted-foreground">Next Due</p>
                            <p className={cn("text-[9px] font-bold", isOverdue ? "text-rose-600" : "text-emerald-600")}>{formatAppDate(sched.nextDue)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-dashed text-[10px] text-muted-foreground font-bold uppercase">No routine maintenance scheduled</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="h-8 text-[9px] uppercase font-bold pl-4">Asset/Area</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold">Service Type</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold">Resolved</TableHead>
                    <TableHead className="h-8 text-[9px] uppercase font-bold text-right pr-4">Staff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyTasks?.length ? (
                    historyTasks.slice(0, 20).map(task => (
                      <TableRow key={task.id} className="text-[10px]">
                        <TableCell className="pl-4 font-bold">{task.roomId}</TableCell>
                        <TableCell className="uppercase text-[9px]">{task.taskType?.replace('_', ' ')}</TableCell>
                        <TableCell>{formatAppDate(task.updatedAt)}</TableCell>
                        <TableCell className="text-right pr-4 font-medium">{task.completedBy || "System"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 uppercase text-[9px] text-muted-foreground font-bold">History empty</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

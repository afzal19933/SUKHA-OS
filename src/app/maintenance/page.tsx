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
import { broadcastNotification } from "@/firebase/notifications";

const COMMON_AREAS = [
  "Front Area", "Cafeteria", "OP Area", "Reception", "Lobby", 
  "Walkways - Floor 1", "Walkways - Floor 2", "Walkways - Floor 3", 
  "Lift", "Stairs - Front", "Stairs - Rear", "Gym", "Prayer Room", 
  "Swimming Pool", "Pool Area", "Guest Bathroom - Male", 
  "Guest Bathroom - Female", "Guest Bathroom - Handicapped", 
  "Staff Bathrooms", "Generator", "Treatment Area", "Kitchen", 
  "Solar Panel", "Housekeeping Room"
];

export default function MaintenancePage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";
  const canUpdateStatus = ["admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  
  const [newTask, setNewTask] = useState({ areaType: "room", roomNumber: "", commonArea: COMMON_AREAS[0], issue: "", priority: "medium" });

  // Queries
  const allTasksQuery = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "housekeeping_tasks") : null, [db, entityId]);

  const { data: allTasks, isLoading } = useCollection(allTasksQuery);

  const activeTasks = useMemo(() => {
    return (allTasks ?? [])
      .filter(t => t?.taskType === "repair" && t?.status !== "completed")
      .sort((a, b) => (b?.createdAt ?? "").localeCompare(a?.createdAt ?? ""));
  }, [allTasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit || !user) return;
    
    const location = newTask.areaType === "room" ? `Room ${newTask.roomNumber}` : newTask.commonArea;
    
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "housekeeping_tasks"), {
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

    broadcastNotification(db, {
      title: "New Repair Request",
      message: `Priority ${newTask.priority} repair reported at ${location}: ${newTask.issue}`,
      type: 'maintenance',
      entityId
    });

    toast({ title: "Work Order Created" });
    setIsAddOpen(false);
    setNewTask({ areaType: "room", roomNumber: "", commonArea: COMMON_AREAS[0], issue: "", priority: "medium" });
  };

  const updateStatus = (task: any, status: string) => {
    if (!entityId || !canUpdateStatus || !user || !task?.id) return;
    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id), { 
      status, 
      updatedAt: new Date().toISOString(), 
      completedAt: status === 'completed' ? new Date().toISOString() : null, 
      completedBy: status === 'completed' ? user.displayName : null 
    });
    
    if (status === 'completed') {
      broadcastNotification(db, {
        title: "Maintenance Resolved",
        message: `Maintenance task at ${task.roomId} has been resolved by ${user.displayName}.`,
        type: 'maintenance',
        entityId
      });
    }

    toast({ title: "Task Updated" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-xl font-bold tracking-tight">Maintenance</h1><p className="text-muted-foreground text-[10px] mt-0.5 uppercase font-bold">Repairs & Care</p></div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button size="sm" className="h-8 text-[10px] font-bold shadow-md" onClick={() => setIsAddOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" /> Repair Request</Button>
              </>
            )}
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="active" className="rounded-lg h-7 px-4 text-[10px] font-bold">Active Repairs</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : activeTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeTasks.map((task) => (
                  <Card key={task.id} className="border-none shadow-sm bg-white overflow-hidden relative">
                    <div className={cn("absolute top-0 left-0 w-1 h-full", task?.priority === "high" ? "bg-rose-500" : "bg-amber-500")} />
                    <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between">
                      <div><Badge className="text-[7px] uppercase">{task?.priority ?? "medium"}</Badge><CardTitle className="text-xs font-bold mt-1">{task?.isCommonArea ? task.roomId : `Room ${task?.roomId ?? "N/A"}`}</CardTitle></div>
                      {canUpdateStatus && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(task, "completed")} className="text-[10px] font-bold text-emerald-600">Resolve Task</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 pt-1.5 space-y-2"><div className="p-2 bg-secondary/30 rounded-lg text-[10px]">{task?.notes ?? "No issue description provided."}</div></CardContent>
                  </Card>
                ))}
              </div>
            ) : (<div className="text-center py-12 bg-white rounded-2xl border border-dashed text-[10px] uppercase">No pending repairs</div>)}
          </TabsContent>
        </Tabs>

        {/* Repair Request Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-[2rem]">
            <DialogHeader><DialogTitle className="text-lg font-black uppercase">New Repair Request</DialogTitle></DialogHeader>
            <form onSubmit={handleAddTask} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Area Type</Label>
                <Select value={newTask.areaType} onValueChange={(v) => setNewTask({...newTask, areaType: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="room">Guest Room</SelectItem><SelectItem value="common_area">Common Area</SelectItem></SelectContent>
                </Select>
              </div>
              {newTask.areaType === 'room' ? (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Room Number</Label>
                  <Input placeholder="Ex: 101" value={newTask.roomNumber} onChange={e => setNewTask({...newTask, roomNumber: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Common Area</Label>
                  <Select value={newTask.commonArea} onValueChange={v => setNewTask({...newTask, commonArea: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>{COMMON_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Issue Description</Label>
                <Input placeholder="Describe the problem..." value={newTask.issue} onChange={e => setNewTask({...newTask, issue: e.target.value})} required className="h-11 rounded-xl bg-secondary/30 border-none font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Priority</Label>
                <Select value={newTask.priority} onValueChange={v => setNewTask({...newTask, priority: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-secondary/30 border-none text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High (Urgent)</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-xl shadow-xl mt-2">Log Repair Request</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

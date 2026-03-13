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
  Filter,
  CheckCircle2,
  Timer
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
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, doc, query, orderBy, where } from "firebase/firestore";
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
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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

export default function MaintenancePage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canUpdateStatus = ["owner", "admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [newTask, setNewTask] = useState({ 
    areaType: "room", 
    roomNumber: "", 
    commonArea: COMMON_AREAS[0],
    issue: "", 
    priority: "medium" 
  });

  const allTasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return collection(db, "hotel_properties", entityId, "housekeeping_tasks");
  }, [db, entityId]);

  const { data: allTasks, isLoading } = useCollection(allTasksQuery);

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
    
    const taskData = {
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
    };

    addDocumentNonBlocking(taskRef, taskData);
    
    sendNotification(db, user.uid, entityId, {
      title: "Maintenance Requested",
      message: `Repair for ${targetArea}: ${newTask.issue}`,
      type: "alert"
    });

    toast({ title: "Work Order Created" });
    setIsAddOpen(false);
    setNewTask({ areaType: "room", roomNumber: "", commonArea: COMMON_AREAS[0], issue: "", priority: "medium" });
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
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track repairs and property history</p>
          </div>
          
          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 px-5 font-bold shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  Work Order
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="text-base">New Work Order</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTask} className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Tabs value={newTask.areaType} onValueChange={(v) => setNewTask({...newTask, areaType: v})} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-secondary/50 h-8">
                        <TabsTrigger value="room" className="text-[10px] h-6">Rooms</TabsTrigger>
                        <TabsTrigger value="common_area" className="text-[10px] h-6">Common</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {newTask.areaType === "room" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Room Number</Label>
                      <Input placeholder="e.g. 101" value={newTask.roomNumber} onChange={(e) => setNewTask({...newTask, roomNumber: e.target.value})} required className="h-9" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Common Area</Label>
                      <Select value={newTask.commonArea} onValueChange={(v) => setNewTask({...newTask, commonArea: v})}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMON_AREAS.map(area => (
                            <SelectItem key={area} value={area} className="text-xs">{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Issue</Label>
                    <Input placeholder="Issue description" value={newTask.issue} onChange={(e) => setNewTask({...newTask, issue: e.target.value})} required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Priority</Label>
                    <Select value={newTask.priority} onValueChange={(val) => setNewTask({...newTask, priority: val})}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high" className="text-xs">High</SelectItem>
                        <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                        <SelectItem value="low" className="text-xs">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-9 font-bold mt-2">Log Request</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="active" className="rounded-lg h-7 px-6 text-[11px] font-bold">Active</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg h-7 px-6 text-[11px] font-bold">History</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : activeTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {activeTasks.map((task) => (
                  <Card key={task.id} className="border-none shadow-sm group bg-white overflow-hidden relative">
                    <div className={cn("absolute top-0 left-0 w-1 h-full", task.priority === "high" ? "bg-rose-500" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500")} />
                    <CardHeader className="p-4 pb-1.5 flex flex-row items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Badge className={cn("text-[8px] uppercase px-1.5 py-0", task.priority === "high" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")} variant="outline">
                            {task.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-[8px] uppercase px-1.5 py-0 h-4">
                            {task.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-bold flex items-center gap-2 pt-0.5">
                          {task.isCommonArea ? <Building2 className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-primary" />}
                          {task.isCommonArea ? task.roomId : `Room ${task.roomId}`}
                        </CardTitle>
                      </div>
                      {canUpdateStatus && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(task, "in_progress")} className="text-xs">Start</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(task, "completed")} className="text-xs text-emerald-600">Complete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1.5 space-y-3">
                      <div className="p-2.5 bg-secondary/30 rounded-lg border border-secondary">
                        <p className="text-[11px] font-medium">{task.notes || "No notes."}</p>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase pt-1 border-t">
                        <span>{formatAppDate(task.createdAt)}</span>
                        <span>By: {task.requestedBy}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed text-xs text-muted-foreground">All clear.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

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

  // Queries
  const activeTasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      where("taskType", "==", "repair"),
      where("status", "!=", "completed")
    );
  }, [db, entityId]);

  const historyTasksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      where("taskType", "==", "repair"),
      where("status", "==", "completed")
    );
  }, [db, entityId]);

  const { data: activeTasks, isLoading: activeLoading } = useCollection(activeTasksQuery);
  const { data: historyTasks, isLoading: historyLoading } = useCollection(historyTasksQuery);

  const sortedActiveTasks = useMemo(() => {
    if (!activeTasks) return [];
    return [...activeTasks].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [activeTasks]);

  const sortedHistoryTasks = useMemo(() => {
    if (!historyTasks) return [];
    return [...historyTasks].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [historyTasks]);

  const filteredHistory = useMemo(() => {
    if (!sortedHistoryTasks) return [];
    if (!historySearch) return sortedHistoryTasks;
    const search = historySearch.toLowerCase();
    return sortedHistoryTasks.filter(t => 
      (t.roomId || "").toLowerCase().includes(search) || 
      (t.notes || "").toLowerCase().includes(search)
    );
  }, [sortedHistoryTasks, historySearch]);

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
      message: `Repair order created for ${targetArea}: ${newTask.issue}`,
      type: "alert"
    });

    toast({ title: "Work Order Created", description: `Assigned for ${targetArea}.` });
    setIsAddOpen(false);
    setNewTask({ areaType: "room", roomNumber: "", commonArea: COMMON_AREAS[0], issue: "", priority: "medium" });
  };

  const updateStatus = (task: any, status: string) => {
    if (!entityId || !canUpdateStatus || !user) return;
    const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", task.id);
    
    const updateData: any = { 
      status, 
      updatedAt: new Date().toISOString() 
    };

    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      updateData.completedBy = user.displayName || "Staff";
      
      sendNotification(db, user.uid, entityId, {
        title: "Repair Completed",
        message: `Maintenance for ${task.roomId} has been marked as completed.`,
        type: "info"
      });
    }

    updateDocumentNonBlocking(taskRef, updateData);
    toast({ title: `Status updated to ${(status || "").replace('_', ' ')}` });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance Tracker</h1>
            <p className="text-muted-foreground mt-1">Real-time property repair monitoring and area-wise audit history</p>
          </div>
          
          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 shadow-lg px-6 font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Work Order
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle>New Work Order</DialogTitle>
                  <DialogDescription>Submit a formal request for facility repair or room maintenance.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddTask} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Select Area Type</Label>
                    <Tabs value={newTask.areaType} onValueChange={(v) => setNewTask({...newTask, areaType: v})} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
                        <TabsTrigger value="room" className="text-xs h-8">Rooms</TabsTrigger>
                        <TabsTrigger value="common_area" className="text-xs h-8">Common Area</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {newTask.areaType === "room" ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Room Number</Label>
                      <Input 
                        placeholder="e.g. 101" 
                        value={newTask.roomNumber}
                        onChange={(e) => setNewTask({...newTask, roomNumber: e.target.value})}
                        required 
                        className="h-10"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">Select Common Area</Label>
                      <Select value={newTask.commonArea} onValueChange={(v) => setNewTask({...newTask, commonArea: v})}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_AREAS.map(area => (
                            <SelectItem key={area} value={area} className="text-sm">{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">Issue Description</Label>
                    <Input 
                      placeholder="e.g. A/C leak, broken faucet" 
                      value={newTask.issue}
                      onChange={(e) => setNewTask({...newTask, issue: e.target.value})}
                      required 
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Priority Level</Label>
                    <Select value={newTask.priority} onValueChange={(val) => setNewTask({...newTask, priority: val})}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High (Immediate Action)</SelectItem>
                        <SelectItem value="medium">Medium (Next 24 Hours)</SelectItem>
                        <SelectItem value="low">Low (Routine Check)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-11 font-bold mt-4">Log Work Order</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="active" className="rounded-lg h-9 px-8 text-xs font-bold flex gap-2">
              <Timer className="w-4 h-4" /> Active Tracker
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg h-9 px-8 text-xs font-bold flex gap-2">
              <History className="w-4 h-4" /> Area-Wise History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {activeLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sortedActiveTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedActiveTasks.map((task) => (
                  <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-all group relative overflow-hidden bg-white">
                    <div className={cn(
                      "absolute top-0 left-0 w-1 h-full",
                      task.priority === "high" ? "bg-rose-500" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <CardHeader className="flex flex-row items-start justify-between p-5 pb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "text-[10px] uppercase font-bold px-2 py-0",
                            task.priority === "high" && "bg-rose-50 text-rose-600 hover:bg-rose-50 border-rose-100",
                            task.priority === "medium" && "bg-amber-50 text-amber-600 hover:bg-amber-50 border-amber-100",
                            task.priority === "low" && "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-emerald-100"
                          )} variant="outline">
                            {task.priority || "Normal"} Priority
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase h-5">
                            {(task.status || "pending").replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 pt-1">
                          {task.isCommonArea ? <Building2 className="w-4 h-4 text-primary" /> : <MapPin className="w-4 h-4 text-primary" />}
                          {task.isCommonArea ? task.roomId : `Room ${task.roomId}`}
                        </CardTitle>
                      </div>
                      {canUpdateStatus && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(task, "in_progress")} className="text-xs">
                              <Timer className="w-3.5 h-3.5 mr-2" /> Start Work
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(task, "completed")} className="text-xs text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(task, "cancelled")} className="text-xs text-rose-500">
                              <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Cancel Request
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-4">
                      <div className="p-3 bg-secondary/30 rounded-xl border border-secondary">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Issue Details</p>
                        <p className="text-sm font-medium leading-relaxed">{task.notes || "No details provided."}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-[10px] font-bold text-muted-foreground uppercase">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Log: {formatAppDate(task.createdAt)}</span>
                        </div>
                        <span>By: {task.requestedBy || 'System'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed flex flex-col items-center">
                <div className="bg-emerald-50 p-4 rounded-full mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-base font-bold">Facility is Running Smoothly</h3>
                <p className="text-xs text-muted-foreground mt-1">No active work orders. All areas are fully functional.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Room or Common Area..." 
                  className="pl-10 h-10 bg-white" 
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <Button variant="outline" className="h-10 font-bold">
                <Filter className="w-4 h-4 mr-2" /> Filter History
              </Button>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <ScrollArea className="h-[550px]">
                <div className="p-0">
                  <Table>
                    <TableHeader className="bg-secondary/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Completion Date</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Area / Location</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Maintenance Details</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Staff / Tech</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider pr-8">Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : filteredHistory.length > 0 ? (
                        filteredHistory.map((task) => (
                          <TableRow key={task.id} className="hover:bg-secondary/20 group">
                            <TableCell className="text-xs font-medium">
                              <div>{formatAppDate(task.updatedAt)}</div>
                              <div className="text-[10px] text-muted-foreground">{formatAppTime(task.updatedAt)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 font-bold text-sm">
                                {task.isCommonArea ? <Building2 className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-primary" />}
                                {task.isCommonArea ? task.roomId : `Room ${task.roomId}`}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground max-w-xs truncate group-hover:whitespace-normal group-hover:max-w-md transition-all">
                                {task.notes || "N/A"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-bold uppercase bg-secondary/30">
                                {task.completedBy || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-8">
                              <Badge className={cn(
                                "text-[9px] uppercase font-bold border-none",
                                task.priority === "high" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                              )}>
                                {task.priority || "Normal"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-24 text-muted-foreground text-sm">
                            No maintenance history found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
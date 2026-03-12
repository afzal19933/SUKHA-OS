
"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  MoreVertical,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
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
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function MaintenancePage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTask, setNewTask] = useState({ roomNumber: "", issue: "", priority: "medium" });

  const taskQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "housekeeping_tasks"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const { data: tasks, isLoading } = useCollection(taskQuery);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId) return;

    const taskRef = collection(db, "hotel_properties", entityId, "housekeeping_tasks");
    const taskData = {
      entityId,
      roomId: newTask.roomNumber,
      taskType: "repair",
      notes: newTask.issue,
      priority: newTask.priority,
      status: "pending",
      dueTime: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(taskRef, taskData);
    toast({ title: "Task created", description: `Work order for room ${newTask.roomNumber} has been logged.` });
    setIsAddOpen(false);
    setNewTask({ roomNumber: "", issue: "", priority: "medium" });
  };

  const updateStatus = (taskId: string, status: string) => {
    if (!entityId) return;
    const taskRef = doc(db, "hotel_properties", entityId, "housekeeping_tasks", taskId);
    updateDocumentNonBlocking(taskRef, { status, updatedAt: new Date().toISOString() });
    toast({ title: "Status updated" });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
            <p className="text-muted-foreground mt-1">Track and manage property repairs</p>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 shadow-lg">
                <Plus className="w-5 h-5 mr-2" />
                New Work Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Work Order</DialogTitle>
                <DialogDescription>Log a new maintenance request.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input 
                    placeholder="101" 
                    value={newTask.roomNumber}
                    onChange={(e) => setNewTask({...newTask, roomNumber: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Issue Description</Label>
                  <Input 
                    placeholder="e.g. A/C not cooling" 
                    value={newTask.issue}
                    onChange={(e) => setNewTask({...newTask, issue: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority Level</Label>
                  <Select value={newTask.priority} onValueChange={(val) => setNewTask({...newTask, priority: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (Urgent)</SelectItem>
                      <SelectItem value="medium">Medium (Today)</SelectItem>
                      <SelectItem value="low">Low (Routine)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Log Request</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between p-6 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-[10px] uppercase font-bold",
                        task.priority === "high" && "bg-rose-100 text-rose-700 hover:bg-rose-100",
                        task.priority === "medium" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                        task.priority === "low" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      )}>
                        {task.priority} Priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">{task.id.slice(0,5)}</span>
                    </div>
                    <CardTitle className="text-xl">Room {task.roomId}</CardTitle>
                  </div>
                  <Select onValueChange={(val) => updateStatus(task.id, val)} value={task.status}>
                    <SelectTrigger className="w-8 h-8 p-0 border-none shadow-none focus:ring-0">
                      <MoreVertical className="w-4 h-4" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Mark Pending</SelectItem>
                      <SelectItem value="in_progress">Start Work</SelectItem>
                      <SelectItem value="completed">Complete Task</SelectItem>
                      <SelectItem value="cancelled">Cancel</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-4">
                  <div className="p-3 bg-secondary rounded-xl flex items-start gap-3">
                    <div className="mt-0.5">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{task.taskType}</p>
                      <p className="text-sm text-muted-foreground">{task.notes}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      {task.status === "pending" && <Clock className="w-4 h-4 text-rose-500" />}
                      {task.status === "in_progress" && <Clock className="w-4 h-4 text-amber-500 animate-pulse" />}
                      {task.status === "completed" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      <span className="text-xs font-medium capitalize">{task.status.replace("_", " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
            <h3 className="text-lg font-semibold">No active maintenance tasks</h3>
            <p className="text-muted-foreground">Property is looking great! Log tasks as needed.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

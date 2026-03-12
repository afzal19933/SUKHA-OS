"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  MoreVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TASKS = [
  { id: "TK-01", room: "104", type: "Repair", issue: "A/C not cooling", priority: "high", status: "pending", date: "Today" },
  { id: "TK-02", room: "205", type: "Maintenance", issue: "Dripping tap in bathroom", priority: "medium", status: "in_progress", date: "Today" },
  { id: "TK-03", room: "108", type: "Inspection", issue: "Routine preventive check", priority: "low", status: "completed", date: "Yesterday" },
  { id: "TK-04", room: "302", type: "Repair", issue: "Smart TV remote missing", priority: "medium", status: "pending", date: "Today" },
];

export default function MaintenancePage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
            <p className="text-muted-foreground mt-1">Track and manage property repairs</p>
          </div>
          <Button className="h-11 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Work Order
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {TASKS.map((task) => (
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
                    <span className="text-xs text-muted-foreground">{task.id}</span>
                  </div>
                  <CardTitle className="text-xl">Room {task.room}</CardTitle>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="p-3 bg-secondary rounded-xl flex items-start gap-3">
                  <div className="mt-0.5">
                    {task.type === "Repair" && <Wrench className="w-4 h-4 text-primary" />}
                    {task.type === "Maintenance" && <Clock className="w-4 h-4 text-primary" />}
                    {task.type === "Inspection" && <CheckCircle className="w-4 h-4 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{task.type}</p>
                    <p className="text-sm text-muted-foreground">{task.issue}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {task.status === "pending" && <Clock className="w-4 h-4 text-rose-500" />}
                    {task.status === "in_progress" && <Clock className="w-4 h-4 text-amber-500 animate-pulse" />}
                    {task.status === "completed" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    <span className="text-xs font-medium capitalize">{task.status.replace("_", " ")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{task.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Brush, 
  ShieldCheck,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROOMS = [
  { id: "101", type: "Standard", status: "available", occupancy: "vacant" },
  { id: "102", type: "Deluxe", status: "cleaning", occupancy: "vacant" },
  { id: "103", type: "Standard", status: "occupied", occupancy: "stayover" },
  { id: "104", type: "Deluxe", status: "maintenance", occupancy: "vacant" },
  { id: "105", type: "Suite", status: "occupied", occupancy: "checkout" },
  { id: "106", type: "Standard", status: "available", occupancy: "vacant" },
  { id: "201", type: "Executive", status: "available", occupancy: "vacant" },
  { id: "202", type: "Executive", status: "cleaning", occupancy: "vacant" },
];

const STATUS_CONFIG = {
  available: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", label: "Clean & Ready" },
  cleaning: { icon: Brush, color: "text-primary", bg: "bg-primary/5", label: "Cleaning" },
  occupied: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50", label: "Occupied" },
  maintenance: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", label: "Maintenance" },
};

export default function HousekeepingPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Room Status</h1>
            <p className="text-muted-foreground mt-1">Real-time housekeeping and maintenance board</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10">Bulk Assign</Button>
            <Button className="h-10">Daily Teams</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {ROOMS.map((room) => {
            const config = STATUS_CONFIG[room.status as keyof typeof STATUS_CONFIG];
            return (
              <Card key={room.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <div className={cn("h-2", config.bg.replace("bg-", "bg-opacity-100 bg-"))} />
                <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold tracking-tight">Room {room.id}</span>
                    <span className="text-xs text-muted-foreground">{room.type}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 pt-4 space-y-4">
                  <div className={cn("flex items-center gap-2 p-2 rounded-lg", config.bg)}>
                    <config.icon className={cn("w-4 h-4", config.color)} />
                    <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0">
                      {room.occupancy}
                    </Badge>
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-primary border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">JD</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

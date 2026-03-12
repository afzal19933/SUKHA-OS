"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const MOCK_RESERVATIONS = [
  { id: "RES-001", guest: "John Doe", room: "102", type: "Deluxe", checkIn: "2024-05-20", checkOut: "2024-05-23", status: "confirmed" },
  { id: "RES-002", guest: "Jane Smith", room: "204", type: "Suite", checkIn: "2024-05-21", checkOut: "2024-05-25", status: "checked_in" },
  { id: "RES-003", guest: "Alice Johnson", room: "105", type: "Standard", checkIn: "2024-05-18", checkOut: "2024-05-20", status: "checked_out" },
  { id: "RES-004", guest: "Bob Wilson", room: "301", type: "Executive", checkIn: "2024-05-22", checkOut: "2024-05-24", status: "pending" },
];

export default function ReservationsPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground mt-1">Manage guest stays and bookings</p>
          </div>
          <Button className="h-11 px-6 font-semibold shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            Walk-in Check-in
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search guest name or reservation ID..." className="pl-10 h-10" />
          </div>
          <Button variant="outline" className="h-10">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Reservation ID</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_RESERVATIONS.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-medium">{res.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{res.guest}</div>
                    <div className="text-xs text-muted-foreground">{res.type}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-secondary/50">{res.room}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{res.checkIn} — {res.checkOut}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "capitalize",
                      res.status === "confirmed" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                      res.status === "checked_in" && "bg-primary/10 text-primary hover:bg-primary/10 border-primary/20",
                      res.status === "pending" && "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
                      res.status === "checked_out" && "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
                    )}>
                      {res.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Details</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
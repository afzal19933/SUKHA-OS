
"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Download, FileText, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";

const MOCK_INVOICES = [
  { id: "INV-2024-001", guest: "John Doe", date: "2024-05-18", amount: "$540.00", status: "paid" },
  { id: "INV-2024-002", guest: "Jane Smith", date: "2024-05-19", amount: "$1,280.00", status: "unpaid" },
  { id: "INV-2024-003", guest: "Bob Wilson", date: "2024-05-20", amount: "$320.00", status: "partial" },
  { id: "INV-2024-004", guest: "Alice Johnson", date: "2024-05-21", amount: "$890.00", status: "paid" },
];

export default function InvoicesPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="text-muted-foreground mt-1">Invoices, payments and financial tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Revenue (MTD)</p>
              <h3 className="text-2xl font-bold">$42,850.00</h3>
            </div>
          </div>
          <div className="p-6 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
              <h3 className="text-2xl font-bold">$3,120.00</h3>
            </div>
          </div>
          <div className="p-6 bg-white rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Payouts</p>
              <h3 className="text-2xl font-bold">$12,400.00</h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-10" />
          </div>
          <Button variant="outline">Export Report</Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_INVOICES.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs font-semibold">{inv.id}</TableCell>
                  <TableCell className="font-medium">{inv.guest}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell className="font-bold">{inv.amount}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "capitalize",
                      inv.status === "paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                      inv.status === "unpaid" && "bg-rose-50 text-rose-600 border-rose-100",
                      inv.status === "partial" && "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Download className="w-4 h-4" />
                    </Button>
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

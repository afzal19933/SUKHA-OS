"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Download, FileText, Search, Loader2 } from "lucide-react";
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
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function InvoicesPage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "invoices"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const { data: invoices, isLoading } = useCollection(invoiceQuery);

  const totalRevenue = invoices?.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) || 0;
  const outstanding = invoices?.reduce((acc, inv) => acc + (inv.balance || 0), 0) || 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Invoices, payments and financial tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-base font-bold">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Outstanding</p>
              <h3 className="text-base font-bold">₹{outstanding.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Processed</p>
              <h3 className="text-base font-bold">{invoices?.length || 0} Invoices</h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-10 h-9 text-sm" />
          </div>
          <Button variant="outline" size="sm">Export Report</Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Invoice #</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Total Amount</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : invoices && invoices.length > 0 ? (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-[10px] font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="font-bold text-sm">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "capitalize text-[10px] px-2 py-0",
                        inv.status === "paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                        inv.status === "issued" && "bg-rose-50 text-rose-600 border-rose-100",
                        inv.status === "draft" && "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    No invoices generated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
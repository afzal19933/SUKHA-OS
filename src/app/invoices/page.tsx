"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Search, Loader2, Building2 } from "lucide-react";
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Separator } from "@/components/ui/separator";

export default function InvoicesPage() {
  const { entityId } = useAuthStore();
  const db = useFirestore();

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "invoices"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const { data: invoices, isLoading } = useCollection(invoiceQuery);
  
  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);
  const { data: property } = useDoc(propertyRef);

  const totalRevenue = invoices?.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) || 0;
  const outstanding = invoices?.reduce((acc, inv) => acc + (inv.balance || 0), 0) || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Billing records and folio history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</p>
              <h3 className="text-sm font-bold">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding</p>
              <h3 className="text-sm font-bold">₹{outstanding.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Processed</p>
              <h3 className="text-sm font-bold">{invoices?.length || 0} Invoices</h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search invoice number..." className="pl-9 h-9 text-[11px]" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 h-9 text-[9px] font-bold uppercase tracking-wider">Invoice #</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Guest</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Total Amount</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right px-4 h-9 text-[9px] font-bold uppercase tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : invoices && invoices.length > 0 ? (
                invoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-secondary/10 group">
                    <TableCell className="px-4 font-mono text-[10px] font-bold text-primary">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-[11px] font-medium">{inv.guestName}</TableCell>
                    <TableCell className="text-[10px]">{formatAppDate(inv.createdAt)}</TableCell>
                    <TableCell className="font-bold text-[11px]">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "capitalize text-[8px] h-4 px-1.5",
                        inv.status === "paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                        inv.status === "issued" && "bg-rose-50 text-rose-600 border-rose-100",
                        inv.status === "draft" && "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-4">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedInvoice(inv)}>
                        View Folio
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-[10px] uppercase font-bold text-muted-foreground">
                    No billing records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Invoice Detail Dialog */}
        <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
            <div className="p-8 space-y-6 bg-white" id="printable-invoice">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold uppercase tracking-tight">{property?.name || "SUKHA RETREATS"}</h2>
                  </div>
                  <p className="text-[9px] text-muted-foreground max-w-[200px] font-medium leading-relaxed">
                    {property?.address || "Address details on file"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Tax Invoice</h3>
                  <p className="text-[10px] font-bold font-mono">{selectedInvoice?.invoiceNumber}</p>
                  <p className="text-[9px] text-muted-foreground font-bold">{formatAppDate(selectedInvoice?.createdAt)}</p>
                </div>
              </div>

              <Separator className="bg-primary/10" />

              <div className="grid grid-cols-2 gap-8 text-[10px]">
                <div className="space-y-1.5">
                  <p className="text-[8px] font-bold uppercase text-muted-foreground">Billed To</p>
                  <p className="font-bold text-sm">{selectedInvoice?.guestName}</p>
                  <p className="text-muted-foreground">Room #{selectedInvoice?.roomNumber}</p>
                </div>
                <div className="space-y-1.5 text-right">
                  <p className="text-[8px] font-bold uppercase text-muted-foreground">Stay Info</p>
                  <p className="font-bold">Reservation ID: {selectedInvoice?.reservationId?.slice(-6).toUpperCase()}</p>
                  <p className="text-muted-foreground">Folio Settlement: {selectedInvoice?.status?.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow className="h-8">
                      <TableHead className="text-[9px] font-bold uppercase">Description</TableHead>
                      <TableHead className="text-right text-[9px] font-bold uppercase">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice?.items?.map((item: any, idx: number) => (
                      <TableRow key={idx} className="h-9 border-b border-primary/5">
                        <TableCell className="text-[10px] font-medium">{item.description}</TableCell>
                        <TableCell className="text-right text-[10px] font-bold">₹{item.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-48 space-y-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground">Grand Total</span>
                    <span className="text-primary text-base">₹{selectedInvoice?.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-[8px] text-muted-foreground uppercase text-right leading-relaxed font-medium">
                      Note: This is a computer-generated document. No signature is required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-secondary/30 border-t flex justify-between gap-3 no-print">
               <Button variant="ghost" className="text-xs font-bold" onClick={() => setSelectedInvoice(null)}>Close</Button>
               <Button className="h-9 px-6 font-bold text-xs shadow-md" onClick={handlePrint}>
                 <Printer className="w-3.5 h-3.5 mr-2" />
                 Print / Download PDF
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

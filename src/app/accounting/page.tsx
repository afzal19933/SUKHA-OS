"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  FileText, 
  Search, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Building2
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doc } from "firebase/firestore";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const EXPENSE_CATEGORIES = [
  "Utilities",
  "Maintenance",
  "Staffing",
  "Laundry",
  "Supplies",
  "Marketing",
  "Other"
];

export default function AccountingPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", category: "Other", date: new Date().toISOString().split('T')[0] });

  // Data fetching
  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "invoices"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const expenseQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "expenses"), orderBy("date", "desc"));
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: invoices, isLoading: invLoading } = useCollection(invoiceQuery);
  const { data: expenses, isLoading: expLoading } = useCollection(expenseQuery);
  const { data: property } = useDoc(propertyRef);

  const totalRevenue = invoices?.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin || !user) return;

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "expenses"), {
      entityId,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      date: newExpense.date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Expense Logged" });
    setIsExpenseOpen(false);
    setNewExpense({ description: "", amount: "", category: "Other", date: new Date().toISOString().split('T')[0] });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Financial Hub</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Revenue & Expense Reconciliation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Gross Revenue</p>
              <h3 className="text-sm font-bold">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Total Expenses</p>
              <h3 className="text-sm font-bold">₹{totalExpenses.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className={cn("p-1.5 rounded-lg", netProfit >= 0 ? "bg-primary/10 text-primary" : "bg-rose-50 text-rose-600")}>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Net Profit</p>
              <h3 className="text-sm font-bold">₹{netProfit.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-9">
            <TabsTrigger value="invoices" className="rounded-lg text-[10px] h-7 px-5">Invoices</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg text-[10px] h-7 px-5">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-2.5 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Invoice #" className="pl-8 h-8 text-[10px]" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[9px] h-8 font-bold uppercase pl-4">Invoice #</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Date</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Amount</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Status</TableHead>
                    <TableHead className="text-right text-[9px] h-8 font-bold uppercase pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : invoices?.length ? (
                    invoices.map((inv) => (
                      <TableRow key={inv.id} className="group">
                        <TableCell className="pl-4 font-mono text-[9px] font-bold text-primary">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-[10px]">{formatAppDate(inv.createdAt)}</TableCell>
                        <TableCell className="font-bold text-[10px]">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[8px] h-3.5 px-1.5", inv.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedInvoice(inv)}>
                            <Printer className="w-2.5 h-2.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-[9px] text-muted-foreground uppercase font-bold">No revenue records</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
             <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-bold uppercase text-muted-foreground">Operating Costs</h2>
              {isAdmin && (
                <Button size="sm" className="h-7 text-[10px] font-bold" onClick={() => setIsExpenseOpen(true)}>Log Expense</Button>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[9px] h-8 font-bold uppercase pl-4">Description</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Category</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Date</TableHead>
                    <TableHead className="text-[9px] h-8 font-bold uppercase">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : expenses?.length ? (
                    expenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="pl-4 text-[10px] font-medium">{exp.description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] h-3.5">{exp.category}</Badge></TableCell>
                        <TableCell className="text-[10px]">{formatAppDate(exp.date)}</TableCell>
                        <TableCell className="text-[10px] font-bold text-rose-600">₹{exp.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-[9px] text-muted-foreground uppercase font-bold">No expense records</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

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

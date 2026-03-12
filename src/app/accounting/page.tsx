"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  FileText, 
  Search, 
  Loader2, 
  Plus, 
  Receipt, 
  TrendingUp, 
  TrendingDown,
  Trash2,
  Filter
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

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
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
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

  const { data: invoices, isLoading: invLoading } = useCollection(invoiceQuery);
  const { data: expenses, isLoading: expLoading } = useCollection(expenseQuery);

  const totalRevenue = invoices?.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;
  const outstanding = invoices?.reduce((acc, inv) => acc + (inv.balance || 0), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

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

  const deleteExpense = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "expenses", id));
    toast({ title: "Expense Deleted" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Comprehensive financial management and audit</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export Data
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-2.5 bg-white rounded-xl border shadow-sm flex items-center gap-2">
            <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-sm font-bold">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl border shadow-sm flex items-center gap-2">
            <div className="p-1 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-sm font-bold">₹{totalExpenses.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl border shadow-sm flex items-center gap-2">
            <div className="p-1 bg-amber-50 text-amber-600 rounded-lg">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Outstanding</p>
              <h3 className="text-sm font-bold">₹{outstanding.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl border shadow-sm flex items-center gap-2">
            <div className={cn(
              "p-1 rounded-lg",
              netProfit >= 0 ? "bg-primary/10 text-primary" : "bg-rose-50 text-rose-600"
            )}>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Net Profit</p>
              <h3 className="text-sm font-bold">₹{netProfit.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="invoices" className="rounded-lg text-xs h-8">Invoices</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg text-xs h-8">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search invoice number..." className="pl-9 h-8 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5" /> Filter
              </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Invoice #</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Date</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Amount</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Status</TableHead>
                    <TableHead className="text-right text-[10px] h-10 font-bold uppercase pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : invoices?.length ? (
                    invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-[10px] font-semibold">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{formatAppDate(inv.createdAt)}</TableCell>
                        <TableCell className="font-bold text-xs">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize text-[9px] px-1.5 py-0 h-4",
                            inv.status === "paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                            inv.status === "issued" && "bg-rose-50 text-rose-600 border-rose-100"
                          )}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="w-3 h-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">No invoices generated.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search expenses..." className="pl-9 h-8 text-xs" />
              </div>
              {isAdmin && (
                <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">Log Business Expense</DialogTitle>
                      <DialogDescription className="text-xs">Record property expenditures for audit.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddExpense} className="space-y-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input 
                          placeholder="e.g. Electricity Bill July" 
                          value={newExpense.description} 
                          onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                          className="h-9 text-sm"
                          required 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Amount (₹)</Label>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={newExpense.amount} 
                            onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                            className="h-9 text-sm"
                            required 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Date</Label>
                          <Input 
                            type="date" 
                            value={newExpense.date} 
                            onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                            className="h-9 text-sm"
                            required 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter className="pt-2">
                        <Button type="submit" className="w-full h-9 text-sm">Save Expense</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Date</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Description</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Category</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Amount</TableHead>
                    <TableHead className="text-right text-[10px] h-10 font-bold uppercase pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : expenses?.length ? (
                    expenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="text-xs">{formatAppDate(exp.date)}</TableCell>
                        <TableCell className="text-xs font-medium">{exp.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold uppercase">
                            {exp.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs text-rose-600">₹{exp.amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-4">
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => deleteExpense(exp.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">No expenses recorded.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

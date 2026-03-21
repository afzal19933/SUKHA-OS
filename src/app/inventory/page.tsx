"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Loader2,
  ShoppingCart,
  History as HistoryIcon,
  Package,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Boxes,
  WashingMachine
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, orderBy, limit, where } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { cn, formatAppDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { broadcastNotification } from "@/firebase/notifications";

const SUPPLY_CATEGORIES = [
  { label: "Cleaning Chemicals", items: ["Floor Cleaner", "Toilet Cleaner", "Room Freshner", "Glass Cleaner", "Surface Sanitizer"] },
  { label: "Guest Amenities", items: ["Water Bottle (500ml)", "Tissue Box", "Soap Kit", "Shampoo Kit", "Toothbrush Kit"] },
  { label: "Washroom Supplies", items: ["Paper Towel Roll", "Toilet Paper Roll", "Bath Mat"] },
  { label: "Tools & Equipment", items: ["Mop Head", "Floor Brush", "Toilet Brush", "Bucket"] },
  { label: "Linen", items: [] } // Items will be fetched from laundry_items
];

export default function InventoryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";

  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isConsumeOpen, setIsConsumptionOpen] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState("");

  const [newPurchase, setNewPurchase] = useState({ 
    itemName: "", category: "", quantity: "", unit: "pcs", totalCost: "", vendor: "", date: new Date().toISOString().split('T')[0] 
  });

  const [newConsumption, setNewConsumption] = useState({
    itemId: "", itemName: "", quantity: "", date: new Date().toISOString().split('T')[0]
  });

  // Data Fetching
  const stocksQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "inventory_stocks"), orderBy("itemName"));
  }, [db, entityId]);

  const laundryItemsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_items"), where("itemType", "==", "linen"));
  }, [db, entityId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "supply_purchases"), orderBy("date", "desc"), limit(100));
  }, [db, entityId]);

  const { data: stocks, isLoading: stocksLoading } = useCollection(stocksQuery);
  const { data: laundryItems } = useCollection(laundryItemsQuery);
  const { data: purchases, isLoading: purchasesLoading } = useCollection(purchasesQuery);

  const mergedCategories = useMemo(() => {
    return SUPPLY_CATEGORIES.map(cat => {
      if (cat.label === "Linen") {
        return { ...cat, items: laundryItems?.map(i => i.itemName) || [] };
      }
      return cat;
    });
  }, [laundryItems]);

  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit) return;

    const qty = parseFloat(newPurchase.quantity);
    const cost = parseFloat(newPurchase.totalCost) || 0;
    
    // 1. Log Purchase
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "supply_purchases"), {
      ...newPurchase,
      quantity: qty,
      totalCost: cost,
      createdAt: new Date().toISOString(),
    });

    // 2. Update Stock
    const existingStock = stocks?.find(s => s.itemName === newPurchase.itemName);
    if (existingStock) {
      updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "inventory_stocks", existingStock.id), {
        currentStock: (existingStock.currentStock || 0) + qty,
        updatedAt: new Date().toISOString()
      });
    } else {
      addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "inventory_stocks"), {
        itemName: newPurchase.itemName,
        category: newPurchase.category,
        currentStock: qty,
        unit: newPurchase.unit,
        minStock: 5,
        updatedAt: new Date().toISOString()
      });
    }

    broadcastNotification(db, {
      title: "New Inventory Purchase",
      message: `New purchase of ${qty} ${newPurchase.unit} of ${newPurchase.itemName} recorded for ₹${cost.toLocaleString()}.`,
      type: 'purchase',
      entityId
    });

    toast({ title: "Purchase Recorded", description: `Added ${qty} ${newPurchase.unit} to stock.` });
    setIsPurchaseOpen(false);
    setNewPurchase({ itemName: "", category: "", quantity: "", unit: "pcs", totalCost: "", vendor: "", date: new Date().toISOString().split('T')[0] });
  };

  const handleLogConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canEdit) return;

    const qty = parseFloat(newConsumption.quantity);
    const stock = stocks?.find(s => s.id === newConsumption.itemId);
    if (!stock) return;

    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "inventory_stocks", stock.id), {
      currentStock: Math.max(0, (stock.currentStock || 0) - qty),
      updatedAt: new Date().toISOString()
    });

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "inventory_transactions"), {
      itemId: stock.id,
      itemName: stock.itemName,
      type: "consumption",
      quantity: qty,
      date: newConsumption.date,
      createdAt: new Date().toISOString()
    });

    toast({ title: "Consumption Logged" });
    setIsConsumptionOpen(false);
    setNewConsumption({ itemId: "", itemName: "", quantity: "", date: new Date().toISOString().split('T')[0] });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">Inventory Management</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mt-0.5">Stock Levels & Consumption Audit</p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button variant="outline" className="h-9 text-[10px] font-black uppercase rounded-xl" onClick={() => setIsConsumptionOpen(true)}>
                  <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" /> Log Consumption
                </Button>
                <Button className="h-9 text-[10px] font-black uppercase rounded-xl shadow-lg" onClick={() => setIsPurchaseOpen(true)}>
                  <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Log Purchase
                </Button>
              </>
            )}
          </div>
        </header>

        <Tabs defaultValue="stocks" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10 shadow-sm">
            <TabsTrigger value="stocks" className="rounded-lg text-[11px] font-bold px-6">Current Stock</TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-lg text-[11px] font-bold px-6">Purchase Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="stocks" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stocksLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-primary" /></div>
              ) : stocks?.length ? (
                stocks.map(stock => {
                  const isLow = (stock.currentStock || 0) <= (stock.minStock || 0);
                  return (
                    <Card key={stock.id} className={cn("border-none shadow-sm rounded-2xl overflow-hidden bg-white", isLow && "ring-2 ring-rose-500/20")}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-[8px] uppercase font-black bg-secondary/50 border-none">{stock.category}</Badge>
                          {isLow && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                        </div>
                        <CardTitle className="text-sm font-black uppercase mt-2">{stock.itemName}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={cn("text-2xl font-black", isLow ? "text-rose-600" : "text-primary")}>{stock.currentStock}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{stock.unit}</span>
                        </div>
                        <p className="text-[8px] text-muted-foreground uppercase font-bold mt-2">Min. Level: {stock.minStock}</p>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-primary/10">
                  <Boxes className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase text-muted-foreground">No stock levels recorded yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] font-black uppercase h-12 pl-8 text-primary-foreground">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Item</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Qty</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-right text-primary-foreground">Cost ₹</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 pr-8 text-right text-primary-foreground">Vendor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : purchases?.length ? (
                    purchases.map((p) => (
                      <TableRow key={p.id} className="group border-b border-secondary/50 hover:bg-primary/5 transition-colors">
                        <TableCell className="pl-8 text-[11px] font-bold">{formatAppDate(p.date)}</TableCell>
                        <TableCell className="text-[11px] font-black uppercase">{p.itemName}</TableCell>
                        <TableCell className="text-[11px] font-bold">{p.quantity} {p.unit}</TableCell>
                        <TableCell className="text-right text-[11px] font-black text-primary">₹{p.totalCost?.toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-8 text-[10px] font-bold text-muted-foreground uppercase">{p.vendor}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-[10px] font-black uppercase text-muted-foreground">No purchase records</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Purchase Dialog */}
        <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
          <DialogContent className="sm:max-w-[450px] rounded-[2.5rem]">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase text-primary">Log Supply Purchase</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Recording a purchase will automatically increment stock levels.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPurchase} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Category</Label>
                  <Select onValueChange={v => setNewPurchase({...newPurchase, category: v, itemName: ""})} required>
                    <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-none"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {mergedCategories.map(c => <SelectItem key={c.label} value={c.label} className="text-xs font-bold">{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Item</Label>
                  <Select value={newPurchase.itemName} onValueChange={v => setNewPurchase({...newPurchase, itemName: v})} required>
                    <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-none"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {mergedCategories.find(c => c.label === newPurchase.category)?.items.map(i => (
                        <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Qty</Label>
                  <Input type="number" step="0.1" value={newPurchase.quantity} onChange={e => setNewPurchase({...newPurchase, quantity: e.target.value})} required className="h-10 rounded-xl bg-secondary/30 border-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Unit</Label>
                  <Select value={newPurchase.unit} onValueChange={v => setNewPurchase({...newPurchase, unit: v})}>
                    <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pcs", "ltr", "kg", "box", "roll"].map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Cost (₹)</Label>
                  <Input type="number" value={newPurchase.totalCost} onChange={e => setNewPurchase({...newPurchase, totalCost: e.target.value})} required className="h-10 rounded-xl bg-secondary/30 border-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black">Vendor</Label>
                <Input placeholder="Store Name" value={newPurchase.vendor} onChange={e => setNewPurchase({...newPurchase, vendor: e.target.value})} className="h-10 rounded-xl bg-secondary/30 border-none" />
              </div>
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">Commit To Stock</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Consumption Dialog */}
        <Dialog open={isConsumeOpen} onOpenChange={setIsConsumptionOpen}>
          <DialogContent className="sm:max-w-[380px] rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase text-primary">Log Consumption</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Record daily usage to maintain accurate stock levels.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleLogConsumption} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black">Select Item</Label>
                <Select value={newConsumption.itemId} onValueChange={v => setNewConsumption({...newConsumption, itemId: v})}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/30 border-none"><SelectValue placeholder="Select stock item" /></SelectTrigger>
                  <SelectContent>
                    {stocks?.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.itemName} ({s.currentStock} left)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black">Quantity Used</Label>
                <Input type="number" step="0.1" value={newConsumption.quantity} onChange={e => setNewConsumption({...newConsumption, quantity: e.target.value})} required className="h-10 rounded-xl bg-secondary/30 border-none" />
              </div>
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">Deduct From Stock</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

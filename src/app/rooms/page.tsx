
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
  DoorOpen, 
  Trash2, 
  Edit3, 
  Loader2,
  ShoppingCart,
  History as HistoryIcon,
  Package,
  Search,
  FilterX
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
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, doc, query, orderBy, limit } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { cn, formatAppDate } from "@/lib/utils";

const BUILDINGS = ["Old Apartment", "New Apartment"];

const SUPPLY_CATEGORIES = [
  { label: "Cleaning Chemicals", items: ["Floor Cleaner", "Toilet Cleaner", "Room Freshener", "Glass Cleaner", "Dish Wash", "Hand Wash"] },
  { label: "Guest Amenities", items: ["Drinking Water Bottles", "Tissue Box", "Soap Kit", "Shampoo Kit"] },
  { label: "Washroom Supplies", items: ["Paper Towel Roll", "Toilet Paper Roll", "C-Fold Paper"] },
  { label: "Tools & Equipment", items: ["Mop Head", "Floor Brush", "Toilet Brush", "Bucket", "Microfiber Cloth"] },
  { label: "Other", items: ["General Supply"] }
];

export default function RoomsPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);

  // Form states
  const [newType, setNewType] = useState({ name: "", rate: "", occupancy: "2" });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "1", typeId: "", building: "" });
  const [newPurchase, setNewPurchase] = useState({ 
    itemName: "", 
    category: "", 
    quantity: "", 
    unit: "pcs", 
    totalCost: "", 
    vendor: "", 
    date: new Date().toISOString().split('T')[0] 
  });

  const [purchaseSearch, setPurchaseSearch] = useState("");

  // Form states for editing
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editingType, setEditingType] = useState<any>(null);

  // Data fetching
  const typesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "room_types"), orderBy("name"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber"));
  }, [db, entityId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "supply_purchases"), orderBy("date", "desc"), limit(100));
  }, [db, entityId]);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: roomTypes, isLoading: typesLoading } = useCollection(typesQuery);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsQuery);
  const { data: purchases, isLoading: purchasesLoading } = useCollection(purchasesQuery);
  const { data: property } = useDoc(propertyRef);

  const isParadise = property?.name?.toLowerCase().includes("paradise");

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    if (!purchaseSearch) return purchases;
    const s = purchaseSearch.toLowerCase();
    return purchases.filter(p => 
      p.itemName?.toLowerCase().includes(s) || 
      p.category?.toLowerCase().includes(s) || 
      p.vendor?.toLowerCase().includes(s)
    );
  }, [purchases, purchaseSearch]);

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "room_types");
    addDocumentNonBlocking(colRef, {
      entityId,
      name: newType.name,
      baseRate: parseFloat(newType.rate),
      maxOccupancy: parseInt(newType.occupancy),
      amenities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Room Category Added" });
    setIsTypeOpen(false);
    setNewType({ name: "", rate: "", occupancy: "2" });
  };

  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "supply_purchases");
    addDocumentNonBlocking(colRef, {
      ...newPurchase,
      quantity: parseFloat(newPurchase.quantity),
      totalCost: parseFloat(newPurchase.totalCost) || 0,
      createdAt: new Date().toISOString(),
    });

    toast({ title: "Purchase Recorded", description: `${newPurchase.itemName} added to history.` });
    setIsPurchaseOpen(false);
    setNewPurchase({ itemName: "", category: "", quantity: "", unit: "pcs", totalCost: "", vendor: "", date: new Date().toISOString().split('T')[0] });
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    const colRef = collection(db, "hotel_properties", entityId, "rooms");
    addDocumentNonBlocking(colRef, {
      entityId,
      roomNumber: newRoom.roomNumber,
      floor: parseInt(newRoom.floor),
      building: isParadise ? newRoom.building : "",
      roomTypeId: newRoom.typeId,
      status: "available",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Physical Room Added" });
    setIsRoomOpen(false);
    setNewRoom({ roomNumber: "", floor: "1", typeId: "", building: "" });
  };

  const deleteRoom = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "rooms", id));
    toast({ title: "Room Deleted" });
  };

  const deletePurchase = (id: string) => {
    if (!entityId || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "supply_purchases", id));
    toast({ title: "Record Deleted" });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">Inventory & Supplies</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mt-0.5">Asset Control & Consumption Log</p>
          </div>
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10 shadow-sm">
            <TabsTrigger value="inventory" className="rounded-lg text-[11px] font-bold px-6">Physical Inventory</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-[11px] font-bold px-6">Room Categories</TabsTrigger>
            <TabsTrigger value="purchase-history" className="rounded-lg text-[11px] font-bold px-6">Purchase History</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <DoorOpen className="w-4 h-4" /> Room List
              </h2>
              {isAdmin && (
                <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg h-9 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px] rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-black uppercase text-primary">Add Physical Room</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddRoom} className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        {isParadise && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Building</Label>
                            <Select value={newRoom.building} onValueChange={v => setNewRoom({...newRoom, building: v})}>
                              <SelectTrigger className="h-10 text-xs bg-secondary/30 border-none rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {BUILDINGS.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Room #</Label>
                          <Input placeholder="101" value={newRoom.roomNumber} onChange={e => setNewRoom({...newRoom, roomNumber: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Floor</Label>
                          <Input type="number" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Category</Label>
                          <Select value={newRoom.typeId} onValueChange={v => setNewRoom({...newRoom, typeId: v})} required>
                            <SelectTrigger className="h-10 text-xs bg-secondary/30 border-none rounded-xl">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {roomTypes?.map(t => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">Create Room</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {roomsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin w-5 h-5 text-primary" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {rooms?.map(room => (
                  <Card key={room.id} className="border-none shadow-sm group hover:shadow-md transition-all rounded-[1.5rem] bg-white overflow-hidden">
                    <CardHeader className="p-4 pb-1 flex flex-row justify-between items-center">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <DoorOpen className="w-4 h-4" />
                          </div>
                          <span className="font-black text-sm uppercase">Room {room.roomNumber}</span>
                        </div>
                        {isParadise && room.building && (
                          <span className="text-[8px] text-muted-foreground uppercase font-black mt-1 tracking-tighter">{room.building}</span>
                        )}
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)} className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Floor {room.floor}</p>
                      <div className="mt-1 text-[11px] font-bold truncate text-primary/70">
                        {roomTypes?.find(t => t.id === room.roomTypeId)?.name || "Uncategorized"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4" /> Pricing Model
              </h2>
              {isAdmin && (
                <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg h-9 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> New Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px] rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-black uppercase text-primary">Create Room Type</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddType} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Category Name</Label>
                        <Input placeholder="Deluxe King" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Rate (₹)</Label>
                          <Input type="number" placeholder="1500" value={newType.rate} onChange={e => setNewType({...newType, rate: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Max Guests</Label>
                          <Input type="number" value={newType.occupancy} onChange={e => setNewType({...newType, occupancy: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">Save Category</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomTypes?.map(type => (
                <Card key={type.id} className="border-none shadow-sm group bg-white rounded-[2rem] overflow-hidden">
                  <CardHeader className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-black uppercase tracking-tight">{type.name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">Capacity: {type.maxOccupancy} Persons</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-primary">₹{type.baseRate}</span>
                        <p className="text-[8px] text-muted-foreground uppercase font-black">Base / Night</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="purchase-history" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Operational Supplies
              </h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search supplies..." 
                    className="pl-10 h-9 text-[11px] bg-white rounded-xl border-none shadow-sm" 
                    value={purchaseSearch}
                    onChange={e => setPurchaseSearch(e.target.value)}
                  />
                </div>
                {isAdmin && (
                  <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg h-9 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl shrink-0">
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Log Purchase
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-primary">Record Supply Purchase</DialogTitle>
                        <DialogDescription className="text-[10px] uppercase font-bold">Track usage of cleaning agents and amenities.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddPurchase} className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Category</Label>
                            <Select onValueChange={v => setNewPurchase({...newPurchase, category: v, itemName: ""})} required>
                              <SelectTrigger className="h-10 text-xs bg-secondary/30 border-none rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {SUPPLY_CATEGORIES.map(c => <SelectItem key={c.label} value={c.label} className="text-xs font-bold">{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Item Name</Label>
                            <Select 
                              value={newPurchase.itemName} 
                              onValueChange={v => setNewPurchase({...newPurchase, itemName: v})} 
                              disabled={!newPurchase.category}
                              required
                            >
                              <SelectTrigger className="h-10 text-xs bg-secondary/30 border-none rounded-xl"><SelectValue placeholder="Select Item" /></SelectTrigger>
                              <SelectContent>
                                {SUPPLY_CATEGORIES.find(c => c.label === newPurchase.category)?.items.map(i => (
                                  <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Qty</Label>
                            <Input type="number" step="0.1" value={newPurchase.quantity} onChange={e => setNewPurchase({...newPurchase, quantity: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Unit</Label>
                            <Select value={newPurchase.unit} onValueChange={v => setNewPurchase({...newPurchase, unit: v})}>
                              <SelectTrigger className="h-10 text-xs bg-secondary/30 border-none rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["pcs", "ltr", "kg", "box", "roll"].map(u => <SelectItem key={u} value={u} className="text-xs uppercase">{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Cost (₹)</Label>
                            <Input type="number" value={newPurchase.totalCost} onChange={e => setNewPurchase({...newPurchase, totalCost: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Vendor / Store</Label>
                            <Input placeholder="Market / Signature" value={newPurchase.vendor} onChange={e => setNewPurchase({...newPurchase, vendor: e.target.value})} className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label>
                            <Input type="date" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})} required className="h-10 text-xs bg-secondary/30 border-none rounded-xl" />
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">Log To History</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] font-black uppercase h-12 pl-8 text-primary-foreground">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Supply Item</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Category</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-center text-primary-foreground">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 text-right text-primary-foreground">Total ₹</TableHead>
                    <TableHead className="text-[10px] font-black uppercase h-12 pr-8 text-right text-primary-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredPurchases.length > 0 ? (
                    filteredPurchases.map((p) => (
                      <TableRow key={p.id} className="group hover:bg-primary/5 transition-colors border-b border-secondary/50">
                        <TableCell className="pl-8 text-[11px] font-bold">{formatAppDate(p.date)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase">{p.itemName}</span>
                            <span className="text-[8px] text-muted-foreground font-bold uppercase">{p.vendor || "Direct Purchase"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] font-black uppercase bg-secondary/50 border-none px-2 h-5">
                            {p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-[11px]">
                          {p.quantity} <span className="text-[9px] text-muted-foreground uppercase">{p.unit}</span>
                        </TableCell>
                        <TableCell className="text-right font-black text-[11px] text-primary">₹{(p.totalCost || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-8">
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deletePurchase(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <HistoryIcon className="w-10 h-10" />
                          <p className="text-[10px] font-black uppercase">No purchase history recorded</p>
                        </div>
                      </TableCell>
                    </TableRow>
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

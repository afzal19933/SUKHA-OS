
"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  WashingMachine, 
  Search, 
  Clock, 
  CheckCircle, 
  Loader2,
  Package,
  ArrowRight,
  Trash2,
  ShoppingCart,
  UserCheck,
  Building2,
  Receipt
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, where } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendNotification } from "@/firebase/notifications";
import { cn } from "@/lib/utils";

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canManageOrders = ["owner", "admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isItemOpen, setIsItemOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", type: "guest", hotelRate: "", vendorRate: "" });
  
  // New Order State
  const [newOrder, setNewOrder] = useState({ 
    roomId: "", 
    roomNumber: "",
    guestName: "", 
    reservationId: "",
    items: [] as { itemId: string, name: string, quantity: number, rate: number }[] 
  });

  const itemsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_items"), orderBy("itemName"));
  }, [db, entityId]);

  const ordersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const roomsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "rooms"), where("status", "==", "occupied"), orderBy("roomNumber"));
  }, [db, entityId]);

  const activeResQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "reservations"),
      where("status", "==", "checked_in")
    );
  }, [db, entityId]);

  const { data: items, isLoading: itemsLoading } = useCollection(itemsQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery);
  const { data: occupiedRooms } = useCollection(roomsQuery);
  const { data: activeReservations } = useCollection(activeResQuery);

  const handleAddServiceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) return;

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "laundry_items"), {
      entityId,
      itemName: newItem.name,
      itemType: newItem.type,
      hotelRate: parseFloat(newItem.hotelRate),
      vendorRate: parseFloat(newItem.vendorRate),
      unit: "piece",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    toast({ title: "Laundry Item Added" });
    setIsItemOpen(false);
    setNewItem({ name: "", type: "guest", hotelRate: "", vendorRate: "" });
  };

  const addItemToOrder = (itemId: string) => {
    const item = items?.find(i => i.id === itemId);
    if (!item) return;

    const existing = newOrder.items.find(i => i.itemId === itemId);
    if (existing) {
      setNewOrder({
        ...newOrder,
        items: newOrder.items.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { itemId, name: item.itemName, quantity: 1, rate: item.hotelRate }]
      });
    }
  };

  const removeItemFromOrder = (itemId: string) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter(i => i.itemId !== itemId)
    });
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setNewOrder({
      ...newOrder,
      items: newOrder.items.map(i => i.itemId === itemId ? { ...i, quantity } : i)
    });
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !canManageOrders || !newOrder.roomId || newOrder.items.length === 0 || !user) {
      toast({ variant: "destructive", title: "Error", description: "Please select an occupied room and add items." });
      return;
    }

    const hotelTotal = newOrder.items.reduce((acc, i) => acc + (i.rate * i.quantity), 0);
    
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), {
      entityId,
      roomId: newOrder.roomId,
      roomNumber: newOrder.roomNumber,
      guestName: newOrder.guestName,
      reservationId: newOrder.reservationId, // Stay Isolation: Linked to current check-in
      items: newOrder.items,
      itemIds: newOrder.items.map(i => i.itemId),
      hotelTotal,
      status: "sent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    sendNotification(db, user.uid, entityId, {
      title: "New Laundry Order",
      message: `Order logged for Room ${newOrder.roomNumber} (${newOrder.guestName})`,
      type: "info"
    });

    toast({ title: "Order Created", description: `Order for Room ${newOrder.roomNumber} logged successfully.` });
    setIsOrderOpen(false);
    setNewOrder({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] });
  };

  const updateOrderStatus = (orderId: string, status: string) => {
    if (!entityId || !canManageOrders) return;
    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderId), {
      status,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Order status updated" });
  };

  const guestItems = useMemo(() => items?.filter(i => i.itemType === 'guest') || [], [items]);
  const hotelLinenItems = useMemo(() => items?.filter(i => i.itemType === 'linen') || [], [items]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <WashingMachine className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Laundry Management</h1>
              <p className="text-muted-foreground mt-1">Guest orders, apartment linen & service audits</p>
            </div>
          </div>
          {isAdmin && (
             <Dialog open={isItemOpen} onOpenChange={setIsItemOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" className="h-10 font-bold border-primary text-primary hover:bg-primary/5">
                 <Plus className="w-4 h-4 mr-2" /> Define Service Item
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Add Laundry Service Item</DialogTitle>
                 <DialogDescription>Define a new item for guest or hotel linen services.</DialogDescription>
               </DialogHeader>
               <form onSubmit={handleAddServiceItem} className="space-y-4 pt-4">
                 <div className="space-y-2">
                   <Label>Item Name</Label>
                   <Input 
                     placeholder="e.g. Cotton Shirt, Bed Sheet (King)" 
                     value={newItem.name} 
                     onChange={e => setNewItem({...newItem, name: e.target.value})}
                     required 
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Item Type</Label>
                   <Select value={newItem.type} onValueChange={v => setNewItem({...newItem, type: v})}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="guest">Guest Laundry</SelectItem>
                       <SelectItem value="linen">Hotel / Apartment Linen</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>{newItem.type === 'guest' ? 'Guest Rate (₹)' : 'Service Cost (₹)'}</Label>
                     <Input type="number" placeholder="5.00" value={newItem.hotelRate} onChange={e => setNewItem({...newItem, hotelRate: e.target.value})} required />
                   </div>
                   <div className="space-y-2">
                     <Label>Vendor Rate (₹)</Label>
                     <Input type="number" placeholder="2.00" value={newItem.vendorRate} onChange={e => setNewItem({...newItem, vendorRate: e.target.value})} required />
                   </div>
                 </div>
                 <Button type="submit" className="w-full h-11 font-bold">Save Item Definition</Button>
               </form>
             </DialogContent>
           </Dialog>
          )}
        </div>

        <Tabs defaultValue="guest-orders" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-12">
            <TabsTrigger value="guest-orders" className="rounded-lg h-full text-xs px-6 gap-2">
              <ShoppingCart className="w-4 h-4" /> Guest Orders
            </TabsTrigger>
            <TabsTrigger value="guest-items" className="rounded-lg h-full text-xs px-6 gap-2">
              <Package className="w-4 h-4" /> Guest Items & Rates
            </TabsTrigger>
            <TabsTrigger value="hotel-laundry" className="rounded-lg h-full text-xs px-6 gap-2">
              <Building2 className="w-4 h-4" /> Hotel / Apartment Laundry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guest-orders" className="space-y-6">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search active guest or room..." className="pl-10 h-10 text-sm" />
              </div>
              {canManageOrders && (
                <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg h-10 px-6 font-bold bg-primary hover:bg-primary/90">
                      <Plus className="w-4 h-4 mr-2" /> New Guest Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <WashingMachine className="w-5 h-5 text-primary" />
                        Log Guest Laundry Order
                      </DialogTitle>
                      <DialogDescription>Select an occupied room to automatically retrieve guest details.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddOrder} className="space-y-6 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room (Occupied Only)</Label>
                          <Select 
                            value={newOrder.roomId} 
                            onValueChange={(val) => {
                              const r = occupiedRooms?.find(room => room.id === val);
                              const activeRes = activeReservations?.find(res => 
                                res.roomNumber?.toString() === r?.roomNumber?.toString()
                              );
                              
                              setNewOrder({
                                ...newOrder, 
                                roomId: val, 
                                roomNumber: r?.roomNumber || "",
                                guestName: activeRes?.guestName || "Walk-in Guest",
                                reservationId: activeRes?.id || ""
                              });
                            }}
                          >
                            <SelectTrigger className="h-11 text-sm font-semibold border-primary/20 bg-primary/5">
                              <SelectValue placeholder="Choose Room..." />
                            </SelectTrigger>
                            <SelectContent>
                              {occupiedRooms && occupiedRooms.length > 0 ? (
                                occupiedRooms.map(room => (
                                  <SelectItem key={room.id} value={room.id} className="font-medium">
                                    Room {room.roomNumber}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No occupied rooms found</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Guest Identity</Label>
                          <div className="h-11 px-3 bg-secondary/50 rounded-lg border flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold truncate">
                              {newOrder.guestName || "Waiting for room selection..."}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">Guest Rate Card</Label>
                          <ScrollArea className="h-[300px] border rounded-2xl p-3 bg-secondary/10">
                            <div className="space-y-1.5">
                              {guestItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-transparent hover:border-primary/20 rounded-xl transition-all shadow-sm group">
                                  <div>
                                    <p className="text-xs font-bold group-hover:text-primary transition-colors">{item.itemName}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">Rate: ₹{item.hotelRate}</p>
                                  </div>
                                  <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg"
                                    onClick={() => addItemToOrder(item.id)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              {guestItems.length === 0 && (
                                <div className="text-center py-10">
                                  <Package className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                                  <p className="text-[10px] text-muted-foreground">No guest items defined.</p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">Order Basket</Label>
                          <ScrollArea className="h-[300px] border rounded-2xl p-3 bg-primary/5">
                            <div className="space-y-2">
                              {newOrder.items.map(i => (
                                <div key={i.itemId} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-primary/10">
                                  <div className="flex-1">
                                    <p className="text-xs font-bold truncate">{i.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-semibold">Total: ₹{i.rate * i.quantity}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input 
                                      type="number" 
                                      className="w-14 h-8 text-[11px] p-1 text-center font-bold" 
                                      value={i.quantity} 
                                      onChange={(e) => updateItemQuantity(i.itemId, parseInt(e.target.value))}
                                    />
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                      onClick={() => removeItemFromOrder(i.itemId)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {newOrder.items.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30">
                                  <ShoppingCart className="w-10 h-10 mb-2" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider">Add items to basket</p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-6 bg-primary/10 rounded-3xl border border-primary/20">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Estimated Amount</p>
                          <p className="text-3xl font-extrabold text-primary">₹{newOrder.items.reduce((acc, i) => acc + (i.rate * i.quantity), 0).toLocaleString()}</p>
                        </div>
                        <Button type="submit" className="h-14 px-12 font-bold shadow-xl rounded-2xl text-lg">Process Order</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6">Stay ID</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Guest & Room</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Order Items</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Charges</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : orders?.length ? (
                    orders.map(order => (
                      <TableRow key={order.id} className="hover:bg-secondary/20 transition-colors">
                        <TableCell className="pl-6">
                           <Badge variant="outline" className="text-[9px] font-mono border-muted text-muted-foreground uppercase">
                             {(order.reservationId || order.id).slice(-6)}
                           </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">Room {order.roomNumber}</div>
                          <div className="text-[10px] text-muted-foreground font-bold tracking-tight">{order.guestName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[10px] font-medium max-w-[250px] truncate bg-secondary/40 px-2 py-1.5 rounded-lg border">
                            {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-sm text-primary">₹{order.hotelTotal?.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            "capitalize text-[9px] px-2.5 py-0.5 font-extrabold tracking-tight",
                            order.status === "sent" && "bg-amber-50 text-amber-600 border-amber-200",
                            order.status === "returned" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                            order.status === "billed" && "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {canManageOrders && order.status === "sent" && (
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => updateOrderStatus(order.id, "returned")}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Return Cleaned
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 ml-1"><ArrowRight className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-32 opacity-30">
                      <Clock className="w-12 h-12 mb-3 text-muted-foreground mx-auto" />
                      <p className="text-sm font-bold uppercase tracking-widest">No active guest laundry records</p>
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="guest-items" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Guest Price List</h2>
                <p className="text-xs text-muted-foreground">Standard rates charged to guests for laundry services</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {guestItems.map(item => (
                <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-white overflow-hidden">
                  <div className="h-1 bg-primary/20 group-hover:bg-primary transition-all" />
                  <CardHeader className="p-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/50 rounded-lg">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <CardTitle className="text-sm font-bold">{item.itemName}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Guest Price</p>
                        <p className="text-lg font-bold text-primary">₹{item.hotelRate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Internal Cost</p>
                        <p className="text-sm font-semibold">₹{item.vendorRate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {guestItems.length === 0 && (
                <div className="col-span-full py-20 border-2 border-dashed rounded-3xl text-center">
                  <p className="text-muted-foreground text-sm">No guest service items configured.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="hotel-laundry" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Linen & Apartment Supplies</h2>
                <p className="text-xs text-muted-foreground">Manage internal inventory and vendor service costs for hotel property linen</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {hotelLinenItems.map(item => (
                <Card key={item.id} className="border-none shadow-sm group bg-white overflow-hidden">
                   <div className="h-1 bg-amber-400/20 group-hover:bg-amber-400 transition-all" />
                  <CardHeader className="p-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <Building2 className="w-4 h-4 text-amber-600" />
                      </div>
                      <CardTitle className="text-sm font-bold">{item.itemName}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-amber-700/60">Vendor Rate</p>
                        <p className="text-lg font-bold text-amber-700">₹{item.vendorRate}</p>
                      </div>
                      <div className="text-right">
                         <Badge variant="outline" className="text-[9px] bg-white text-amber-600 border-amber-200">INTERNAL</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {hotelLinenItems.length === 0 && (
                <div className="col-span-full py-20 border-2 border-dashed rounded-3xl text-center bg-secondary/5">
                  <p className="text-muted-foreground text-sm">No hotel linen items configured.</p>
                </div>
              )}
            </div>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Recent Linen Service Audits
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-12 text-center text-muted-foreground/40">
                  <p className="text-sm font-medium">Linen inventory tracking and bulk vendor orders module coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

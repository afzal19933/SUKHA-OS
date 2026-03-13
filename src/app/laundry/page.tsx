
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
  UserCheck
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
    return query(collection(db, "hotel_properties", entityId, "rooms"), orderBy("roomNumber"));
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
  const { data: rooms } = useCollection(roomsQuery);
  const { data: activeReservations } = useCollection(activeResQuery);

  const occupiedRooms = useMemo(() => {
    return rooms?.filter(r => r.status === 'occupied') || [];
  }, [rooms]);

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
      toast({ variant: "destructive", title: "Error", description: "Please fill all details and add items." });
      return;
    }

    const hotelTotal = newOrder.items.reduce((acc, i) => acc + (i.rate * i.quantity), 0);
    
    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), {
      entityId,
      roomId: newOrder.roomId,
      roomNumber: newOrder.roomNumber,
      guestName: newOrder.guestName,
      reservationId: newOrder.reservationId,
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <WashingMachine className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laundry Services</h1>
            <p className="text-muted-foreground mt-1">Manage guest orders and linen inventory</p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="orders" className="rounded-lg h-8 text-xs px-6">Guest Orders</TabsTrigger>
            <TabsTrigger value="price-list" className="rounded-lg h-8 text-xs px-6">Service Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search guest name or room..." className="pl-10 h-9 text-sm" />
              </div>
              {canManageOrders && (
                <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg h-9 text-sm font-bold"><Plus className="w-4 h-4 mr-2" /> New Order</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <WashingMachine className="w-5 h-5 text-primary" />
                        New Guest Laundry Order
                      </DialogTitle>
                      <DialogDescription>Create an order for an occupied guest stay.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddOrder} className="space-y-6 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Occupied Room</Label>
                          <Select 
                            value={newOrder.roomId} 
                            onValueChange={(val) => {
                              const r = rooms?.find(room => room.id === val);
                              // Find checked_in reservation for this room number
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
                            <SelectTrigger className="h-10 text-sm font-semibold border-primary/20 bg-primary/5">
                              <SelectValue placeholder="Choose a room" />
                            </SelectTrigger>
                            <SelectContent>
                              {occupiedRooms.length > 0 ? (
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
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Guest Identity</Label>
                          <div className="h-10 px-3 bg-secondary/50 rounded-md border flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold truncate">
                              {newOrder.guestName || "Select room first..."}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">Available Services</Label>
                          <ScrollArea className="h-[280px] border rounded-xl p-3 bg-secondary/10">
                            <div className="space-y-1.5">
                              {items?.filter(i => i.itemType === 'guest').map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 bg-white border border-transparent hover:border-primary/20 rounded-xl transition-all shadow-sm group">
                                  <div>
                                    <p className="text-xs font-bold group-hover:text-primary transition-colors">{item.itemName}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">₹{item.hotelRate}</p>
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
                              {(!items || items.length === 0) && (
                                <div className="text-center py-10">
                                  <Package className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                                  <p className="text-[10px] text-muted-foreground">No services configured.</p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">Order Basket</Label>
                          <ScrollArea className="h-[280px] border rounded-xl p-3 bg-primary/5">
                            <div className="space-y-2">
                              {newOrder.items.map(i => (
                                <div key={i.itemId} className="flex items-center justify-between p-2.5 bg-white rounded-xl shadow-sm border border-primary/10">
                                  <div className="flex-1">
                                    <p className="text-xs font-bold truncate">{i.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-semibold">₹{i.rate * i.quantity}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input 
                                      type="number" 
                                      className="w-12 h-8 text-[11px] p-1 text-center font-bold" 
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
                                  <p className="text-xs font-bold uppercase tracking-wider">Empty Basket</p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-primary/10 rounded-2xl border border-primary/20">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Total Amount</p>
                          <p className="text-2xl font-extrabold text-primary">₹{newOrder.items.reduce((acc, i) => acc + (i.rate * i.quantity), 0).toLocaleString()}</p>
                        </div>
                        <Button type="submit" className="h-12 px-10 font-bold shadow-xl rounded-xl">Generate Order</Button>
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
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Order #</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Guest & Room</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Details</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Amount</TableHead>
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
                        <TableCell className="font-mono text-[10px] font-semibold text-muted-foreground">{order.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">Room {order.roomNumber}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{order.guestName || "Guest"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[10px] font-medium max-w-[200px] truncate bg-secondary/30 px-2 py-1 rounded-md">
                            {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") || "No items"}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-sm text-primary">₹{order.hotelTotal?.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            "capitalize text-[9px] px-2 py-0.5 font-extrabold tracking-tight",
                            order.status === "sent" && "bg-amber-50 text-amber-600 border-amber-200",
                            order.status === "returned" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                            order.status === "billed" && "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {canManageOrders && order.status === "sent" && (
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => updateOrderStatus(order.id, "returned")}>
                              <CheckCircle className="w-3 h-3 mr-1.5" /> Mark Returned
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 ml-1"><ArrowRight className="w-3.5 h-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-24 flex flex-col items-center justify-center opacity-30">
                      <Clock className="w-12 h-12 mb-2 text-muted-foreground" />
                      <p className="text-sm font-bold uppercase tracking-widest">No laundry orders</p>
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="price-list" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold tracking-tight">Service Rate Card</h2>
              {isAdmin && (
                <Dialog open={isItemOpen} onOpenChange={setIsItemOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg h-9 text-sm font-bold"><Plus className="w-4 h-4 mr-2" /> Add Service Item</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Service Item</DialogTitle>
                      <DialogDescription>Define a new item for laundry services.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddServiceItem} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Item Name</Label>
                        <Input 
                          placeholder="Shirt, Bed Sheet, etc." 
                          value={newItem.name} 
                          onChange={e => setNewItem({...newItem, name: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={newItem.type} onValueChange={v => setNewItem({...newItem, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guest">Guest Service</SelectItem>
                            <SelectItem value="linen">Hotel Linen</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Guest Rate (₹)</Label>
                          <Input type="number" placeholder="5.00" value={newItem.hotelRate} onChange={e => setNewItem({...newItem, hotelRate: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Vendor Cost (₹)</Label>
                          <Input type="number" placeholder="2.00" value={newItem.vendorRate} onChange={e => setNewItem({...newItem, vendorRate: e.target.value})} required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-10 font-bold">Save Service Item</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {itemsLoading ? (
                <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
              ) : items?.map(item => (
                <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden bg-white">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-secondary/50 rounded-xl">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-bold">{item.itemName}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="capitalize text-[9px] font-extrabold px-1.5 h-4">{item.itemType}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center justify-between bg-secondary/20 p-3 rounded-xl border">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Guest Price</p>
                        <p className="text-xl font-extrabold text-primary">₹{item.hotelRate}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" />
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Vendor Cost</p>
                        <p className="text-lg font-bold text-muted-foreground">₹{item.vendorRate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!items || items.length === 0) && (
                <div className="col-span-full text-center py-20 border border-dashed rounded-3xl bg-secondary/5">
                   <p className="text-sm text-muted-foreground font-semibold">No service items configured. Click "Add Service Item" to begin.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/badge";
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
    return collection(db, "hotel_properties", entityId, "rooms");
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
  const { data: allRooms } = useCollection(roomsQuery);
  const { data: activeReservations } = useCollection(activeResQuery);

  const occupiedRooms = useMemo(() => {
    if (!allRooms) return [];
    return allRooms
      .filter(r => r.status === 'occupied' || r.status === 'occupied_dirty' || r.status === 'occupied_cleaning')
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [allRooms]);

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

    toast({ title: "Item Added" });
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
    setNewOrder({ ...newOrder, items: newOrder.items.filter(i => i.itemId !== itemId) });
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
      toast({ variant: "destructive", title: "Error", description: "Select a room and add items." });
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

    toast({ title: "Order Created" });
    setIsOrderOpen(false);
    setNewOrder({ roomId: "", roomNumber: "", guestName: "", reservationId: "", items: [] });
  };

  const updateOrderStatus = (orderId: string, status: string) => {
    if (!entityId || !canManageOrders) return;
    updateDocumentNonBlocking(doc(db, "hotel_properties", entityId, "guest_laundry_orders", orderId), {
      status, updatedAt: new Date().toISOString()
    });
    toast({ title: "Updated" });
  };

  const guestItems = useMemo(() => items?.filter(i => i.itemType === 'guest') || [], [items]);
  const hotelLinenItems = useMemo(() => items?.filter(i => i.itemType === 'linen') || [], [items]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <WashingMachine className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Laundry</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Guest & hotel linen management</p>
            </div>
          </div>
          {isAdmin && (
             <Dialog open={isItemOpen} onOpenChange={setIsItemOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" className="h-9 font-bold text-xs border-primary text-primary">
                 <Plus className="w-3.5 h-3.5 mr-1.5" /> Define Item
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[400px]">
               <DialogHeader><DialogTitle className="text-base">Add Service Item</DialogTitle></DialogHeader>
               <form onSubmit={handleAddServiceItem} className="space-y-3 pt-2">
                 <div className="space-y-1.5">
                   <Label className="text-xs">Name</Label>
                   <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required className="h-9" />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Type</Label>
                   <Select value={newItem.type} onValueChange={v => setNewItem({...newItem, type: v})}>
                     <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="guest" className="text-xs">Guest Laundry</SelectItem>
                       <SelectItem value="linen" className="text-xs">Hotel Linen</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                     <Label className="text-xs">Hotel Rate</Label>
                     <Input type="number" value={newItem.hotelRate} onChange={e => setNewItem({...newItem, hotelRate: e.target.value})} required className="h-9" />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-xs">Vendor Rate</Label>
                     <Input type="number" value={newItem.vendorRate} onChange={e => setNewItem({...newItem, vendorRate: e.target.value})} required className="h-9" />
                   </div>
                 </div>
                 <Button type="submit" className="w-full h-9 font-bold mt-2">Save Item</Button>
               </form>
             </DialogContent>
           </Dialog>
          )}
        </div>

        <Tabs defaultValue="guest-orders" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl h-10">
            <TabsTrigger value="guest-orders" className="rounded-lg h-full text-[11px] px-5 gap-2">Orders</TabsTrigger>
            <TabsTrigger value="guest-items" className="rounded-lg h-full text-[11px] px-5 gap-2">Guest Rates</TabsTrigger>
            <TabsTrigger value="hotel-laundry" className="rounded-lg h-full text-[11px] px-5 gap-2">Linen</TabsTrigger>
          </TabsList>

          <TabsContent value="guest-orders" className="space-y-4">
            <div className="flex justify-between items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search room..." className="pl-9 h-9 text-xs" />
              </div>
              {canManageOrders && (
                <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-9 px-5 font-bold text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Order</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader><DialogTitle className="text-base">New Guest Order</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddOrder} className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Room</Label>
                          <Select 
                            value={newOrder.roomId} 
                            onValueChange={(val) => {
                              const r = occupiedRooms?.find(room => room.id === val);
                              const activeRes = activeReservations?.find(res => res.roomNumber?.toString() === r?.roomNumber?.toString());
                              setNewOrder({
                                ...newOrder, roomId: val, roomNumber: r?.roomNumber || "",
                                guestName: activeRes?.guestName || "Guest",
                                reservationId: activeRes?.id || ""
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Room" /></SelectTrigger>
                            <SelectContent>
                              {occupiedRooms?.map(room => <SelectItem key={room.id} value={room.id} className="text-xs">Room {room.roomNumber}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Guest</Label>
                          <div className="h-8 px-2 bg-secondary/50 rounded flex items-center text-xs font-bold truncate">{newOrder.guestName || "..."}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-primary">Service List</Label>
                          <ScrollArea className="h-[160px] border rounded-lg p-1.5 bg-secondary/10">
                            {guestItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-1.5 mb-1 bg-white border rounded shadow-sm">
                                <span className="text-[10px] font-bold truncate flex-1">{item.itemName}</span>
                                <Button type="button" variant="secondary" size="icon" className="h-5 w-5 ml-1" onClick={() => addItemToOrder(item.id)}><Plus className="w-2.5 h-2.5" /></Button>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-primary">Basket</Label>
                          <ScrollArea className="h-[160px] border rounded-lg p-1.5 bg-primary/5">
                            {newOrder.items.map(i => (
                              <div key={i.itemId} className="flex items-center justify-between p-1.5 mb-1 bg-white rounded border shadow-sm">
                                <span className="text-[10px] font-bold truncate flex-1">{i.name}</span>
                                <div className="flex items-center gap-1">
                                  <Input type="number" className="w-7 h-5 text-[9px] p-0 text-center" value={i.quantity} onChange={(e) => updateItemQuantity(i.itemId, parseInt(e.target.value))} />
                                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-rose-500" onClick={() => removeItemFromOrder(i.itemId)}><Trash2 className="w-2.5 h-2.5" /></Button>
                                </div>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                        <div className="text-xl font-extrabold text-primary">₹{newOrder.items.reduce((acc, i) => acc + (i.rate * i.quantity), 0).toLocaleString()}</div>
                        <Button type="submit" className="h-9 px-6 font-bold text-xs">Confirm Order</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] h-10 font-bold uppercase pl-5">Guest & Room</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Items</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Total</TableHead>
                    <TableHead className="text-center text-[10px] h-10 font-bold uppercase">Status</TableHead>
                    <TableHead className="text-right text-[10px] h-10 font-bold uppercase pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin w-5 h-5 mx-auto text-primary" /></TableCell></TableRow>
                  ) : orders?.length ? (
                    orders.map(order => (
                      <TableRow key={order.id} className="hover:bg-secondary/10">
                        <TableCell className="pl-5">
                          <div className="font-bold text-xs">Room {order.roomNumber}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{order.guestName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[10px] font-medium max-w-[200px] truncate bg-secondary/50 px-2 py-1 rounded">
                            {order.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-xs text-primary">₹{order.hotelTotal?.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("text-[8px] h-4 px-1.5 uppercase", order.status === "sent" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-5">
                          {canManageOrders && order.status === "sent" && (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-emerald-600" onClick={() => updateOrderStatus(order.id, "returned")}>
                              Return
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">No orders found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="guest-items" className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] h-10 font-bold uppercase pl-5">Item Name</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Hotel Rate</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Vendor Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 text-xs font-bold">{item.itemName}</TableCell>
                      <TableCell className="text-xs">₹{item.hotelRate}</TableCell>
                      <TableCell className="text-xs">₹{item.vendorRate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="hotel-laundry" className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[10px] h-10 font-bold uppercase pl-5">Linen Name</TableHead>
                    <TableHead className="text-[10px] h-10 font-bold uppercase">Cost per Piece</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotelLinenItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 text-xs font-bold">{item.itemName}</TableCell>
                      <TableCell className="text-xs">₹{item.hotelRate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

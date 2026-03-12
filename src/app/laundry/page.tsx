
"use client";

import { useState } from "react";
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
  ArrowRight
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
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");
  const canManageOrders = ["owner", "admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isItemOpen, setIsItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", type: "guest", hotelRate: "", vendorRate: "" });

  const itemsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "laundry_items"), orderBy("itemName"));
  }, [db, entityId]);

  const ordersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), orderBy("createdAt", "desc"));
  }, [db, entityId]);

  const { data: items, isLoading: itemsLoading } = useCollection(itemsQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery);

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
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="orders" className="rounded-lg">Guest Orders</TabsTrigger>
            <TabsTrigger value="price-list" className="rounded-lg">Service Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search guest name or room..." className="pl-10" />
              </div>
              {canManageOrders && (
                <Button className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> New Order</Button>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Guest & Room</TableHead>
                    <TableHead>Total Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : orders?.length ? (
                    orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{order.guestName}</div>
                          <div className="text-xs text-muted-foreground">Room {order.roomNumber}</div>
                        </TableCell>
                        <TableCell>{order.itemIds?.length || 0} items</TableCell>
                        <TableCell className="font-bold">${order.hotelTotal}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            order.status === "sent" && "bg-amber-50 text-amber-600 border-amber-100",
                            order.status === "returned" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                            order.status === "billed" && "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageOrders && (
                            <Button variant="ghost" size="sm" onClick={() => updateOrderStatus(order.id, "returned")}>
                              {order.status === "sent" ? "Mark Returned" : "Details"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No orders logged yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="price-list" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Service Price List</h2>
              {isAdmin && (
                <Dialog open={isItemOpen} onOpenChange={setIsItemOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Add Service Item</Button>
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
                          <Label>Guest Rate</Label>
                          <Input type="number" placeholder="5.00" value={newItem.hotelRate} onChange={e => setNewItem({...newItem, hotelRate: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Vendor Cost</Label>
                          <Input type="number" placeholder="2.00" value={newItem.vendorRate} onChange={e => setNewItem({...newItem, vendorRate: e.target.value})} required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full">Save Service Item</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {itemsLoading ? (
                <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin" /></div>
              ) : items?.map(item => (
                <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary rounded-lg">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{item.itemName}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="capitalize text-[10px]">{item.itemType}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Guest Price</p>
                        <p className="text-xl font-bold">${item.hotelRate}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" />
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Vendor Cost</p>
                        <p className="text-lg font-semibold text-muted-foreground">${item.vendorRate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

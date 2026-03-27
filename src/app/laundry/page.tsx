"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, where } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { safeAsync } from "@/lib/utils"; // ✅ IMPORTANT

export default function LaundryPage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = currentUserRole === "admin";
  const canManageOrders = ["admin", "manager", "supervisor", "staff"].includes(currentUserRole || "");

  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isLinenOpen, setIsLinenOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const [newOrder, setNewOrder] = useState({
    roomId: "",
    roomNumber: "",
    guestName: "",
    reservationId: "",
    items: [] as any[],
  });

  const [newLinenBatch, setNewLinenBatch] = useState({ items: [] as any[] });

  const [newVendorPayment, setNewVendorPayment] = useState({
    amount: "",
    method: "UPI",
    reference: "",
    notes: "",
    category: "hotel",
  });

  // 🔵 DATA FETCHING (already safe)
  const guestOrdersQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "guest_laundry_orders"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const { data: guestOrders, isLoading: ordersLoading } = useCollection(guestOrdersQuery);

  // 🟢 CREATE ORDER (SAFE)
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    await safeAsync(
      async () => {
        if (!entityId || !newOrder.roomId || newOrder.items.length === 0 || !canManageOrders) return;

        const hotelTotal = newOrder.items.reduce(
          (sum, i) => sum + i.hotelRate * i.quantity,
          0
        );

        const vendorTotal = newOrder.items.reduce(
          (sum, i) => sum + i.vendorRate * i.quantity,
          0
        );

        addDocumentNonBlocking(
          collection(db, "hotel_properties", entityId, "guest_laundry_orders"),
          {
            ...newOrder,
            hotelTotal,
            vendorTotal,
            status: "sent",
            createdAt: new Date().toISOString(),
          }
        );

        toast({ title: "Order Created" });

        setIsOrderOpen(false);
        setNewOrder({
          roomId: "",
          roomNumber: "",
          guestName: "",
          reservationId: "",
          items: [],
        });
      },
      null,
      "CREATE_ORDER"
    );
  };

  // 🟢 CREATE LINEN BATCH (SAFE)
  const handleCreateLinenBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    await safeAsync(
      async () => {
        if (!entityId || newLinenBatch.items.length === 0 || !canManageOrders) return;

        addDocumentNonBlocking(
          collection(db, "hotel_properties", entityId, "linen_laundry_batches"),
          {
            items: newLinenBatch.items,
            status: "sent",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );

        toast({ title: "Batch Created" });

        setIsLinenOpen(false);
        setNewLinenBatch({ items: [] });
      },
      null,
      "CREATE_LINEN_BATCH"
    );
  };

  // 🟢 RECORD PAYMENT (SAFE)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    await safeAsync(
      async () => {
        if (!entityId || !newVendorPayment.amount || !canEdit) return;

        addDocumentNonBlocking(
          collection(db, "hotel_properties", entityId, "laundry_vendor_payments"),
          {
            amount: parseFloat(newVendorPayment.amount),
            paymentMethod: newVendorPayment.method,
            reference: newVendorPayment.reference,
            notes: newVendorPayment.notes,
            category: newVendorPayment.category,
            paymentDate: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
          }
        );

        toast({ title: "Payment Recorded" });

        setIsPaymentOpen(false);
        setNewVendorPayment({
          amount: "",
          method: "UPI",
          reference: "",
          notes: "",
          category: "hotel",
        });
      },
      null,
      "RECORD_PAYMENT"
    );
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">

        <h1 className="text-xl font-bold">Laundry Management</h1>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {ordersLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              guestOrders?.map((order) => (
                <div key={order.id}>
                  {order.roomNumber} - ₹{order.hotelTotal}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={() => setIsOrderOpen(true)}>
          <Plus /> Create Order
        </Button>

      </div>
    </AppLayout>
  );
}
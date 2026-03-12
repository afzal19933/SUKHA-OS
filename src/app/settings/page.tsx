
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Building, Percent, Plus, ShieldCheck } from "lucide-react";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { entityId, role: currentUserRole, setEntityId } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const gstRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId, "gst_settings", "default");
  }, [db, entityId]);

  const { data: property, isLoading: propLoading } = useDoc(propertyRef);
  const { data: gst, isLoading: gstLoading } = useDoc(gstRef);

  const [propForm, setPropForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [gstForm, setGstForm] = useState({ gstin: "", sacCode: "", gstRate: "12", cgstRate: "6", sgstRate: "6" });
  
  // New Entity Form State
  const [isNewEntityOpen, setIsNewEntityOpen] = useState(false);
  const [newEntity, setNewEntity] = useState({ name: "", address: "", phone: "" });

  useEffect(() => {
    if (property) {
      setPropForm({
        name: property.name || "",
        address: property.address || "",
        phone: property.phone || "",
        email: property.email || ""
      });
    }
    if (gst) {
      setGstForm({
        gstin: gst.gstin || "",
        sacCode: gst.sacCode || "",
        gstRate: gst.gstRate?.toString() || "12",
        cgstRate: gst.cgstRate?.toString() || "6",
        sgstRate: gst.sgstRate?.toString() || "6"
      });
    }
  }, [property, gst]);

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyRef || !isAdmin) return;
    await updateDoc(propertyRef, { ...propForm, updatedAt: new Date().toISOString() });
    toast({ title: "Property updated successfully" });
  };

  const handleUpdateGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gstRef || !isAdmin) return;
    await updateDoc(gstRef, {
      ...gstForm,
      gstRate: parseFloat(gstForm.gstRate),
      cgstRate: parseFloat(gstForm.cgstRate),
      sgstRate: parseFloat(gstForm.sgstRate),
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Tax settings updated" });
  };

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const newId = crypto.randomUUID();
    const propsRef = collection(db, "hotel_properties");
    
    const entityData = {
      id: newId,
      entityId: newId,
      name: newEntity.name,
      address: newEntity.address,
      phone: newEntity.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      email: propForm.email || ""
    };

    addDocumentNonBlocking(propsRef, entityData);
    toast({ title: "New Entity Added", description: `Property "${newEntity.name}" has been created.` });
    
    // Automatically switch to the new entity
    setEntityId(newId);
    setIsNewEntityOpen(false);
    setNewEntity({ name: "", address: "", phone: "" });
  };

  if (propLoading || gstLoading) {
    return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground mt-1">Configure property profile and billing configuration</p>
          </div>
          {isAdmin && (
            <Dialog open={isNewEntityOpen} onOpenChange={setIsNewEntityOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 shadow-lg">
                  <Plus className="w-4 h-4 mr-2" /> Add Another Entity
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Property</DialogTitle>
                  <DialogDescription>Create a new hotel entity for multi-property management.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEntity} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Property Name</Label>
                    <Input 
                      placeholder="e.g. Sukha Resorts North" 
                      value={newEntity.name} 
                      onChange={e => setNewEntity({...newEntity, name: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input 
                      placeholder="Physical location" 
                      value={newEntity.address} 
                      onChange={e => setNewEntity({...newEntity, address: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      placeholder="Contact number" 
                      value={newEntity.phone} 
                      onChange={e => setNewEntity({...newEntity, phone: e.target.value})}
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full">Create Property</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="profile">Property Profile</TabsTrigger>
            <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <CardTitle>Establishment Profile</CardTitle>
                </div>
                <CardDescription>General information about your hotel property.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProperty} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business Name</Label>
                      <Input value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input type="email" value={propForm.email} onChange={e => setPropForm({...propForm, email: e.target.value})} disabled={!isAdmin} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2 w-full md:w-1/2">
                    <Label>Phone Number</Label>
                    <Input value={propForm.phone} onChange={e => setPropForm({...propForm, phone: e.target.value})} disabled={!isAdmin} />
                  </div>
                  {isAdmin && (
                    <Button type="submit" className="mt-4 shadow-md">
                      <Save className="w-4 h-4 mr-2" /> Save Profile
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-primary" />
                  <CardTitle>GST Configuration</CardTitle>
                </div>
                <CardDescription>Regional tax rates for invoicing.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateGst} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>GSTIN Number</Label>
                      <Input placeholder="Enter GSTIN" value={gstForm.gstin} onChange={e => setGstForm({...gstForm, gstin: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>SAC Code</Label>
                      <Input placeholder="9963" value={gstForm.sacCode} onChange={e => setGstForm({...gstForm, sacCode: e.target.value})} disabled={!isAdmin} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Overall GST (%)</Label>
                      <Input type="number" value={gstForm.gstRate} onChange={e => setGstForm({...gstForm, gstRate: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>CGST (%)</Label>
                      <Input type="number" value={gstForm.cgstRate} onChange={e => setGstForm({...gstForm, cgstRate: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>SGST (%)</Label>
                      <Input type="number" value={gstForm.sgstRate} onChange={e => setGstForm({...gstForm, sgstRate: e.target.value})} disabled={!isAdmin} />
                    </div>
                  </div>
                  {isAdmin && (
                    <Button type="submit" className="shadow-md">
                      <Save className="w-4 h-4 mr-2" /> Update Tax Config
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

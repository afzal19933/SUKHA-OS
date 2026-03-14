
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, collection, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Building, Percent, Plus, Palette, Check, MessageSquare, Key } from "lucide-react";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: 'default', name: 'Sukha Indigo', color: 'bg-[#5F5FA7]' },
  { id: 'emerald', name: 'Forest Emerald', color: 'bg-[#10b981]' },
  { id: 'rose', name: 'Royal Rose', color: 'bg-[#e11d48]' },
  { id: 'amber', name: 'Golden Amber', color: 'bg-[#f59e0b]' },
  { id: 'slate', name: 'Slate Professional', color: 'bg-[#334155]' },
];

export default function SettingsPage() {
  const { entityId, role: currentUserRole, setEntityId, theme, setTheme } = useAuthStore();
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

  const [propForm, setPropForm] = useState({ 
    name: "", 
    address: "", 
    phone: "", 
    email: "", 
    whatsappNumber: "", 
    whatsappBusinessId: "",
    whatsappAccessToken: "" 
  });
  
  const [gstForm, setGstForm] = useState({ 
    gstin: "", 
    sacCode: "", 
    roomGstRate: "5", 
    roomCgstRate: "2.5", 
    roomSgstRate: "2.5",
    serviceGstRate: "18",
    serviceCgstRate: "9",
    serviceSgstRate: "9"
  });
  
  const [isNewEntityOpen, setIsNewEntityOpen] = useState(false);
  const [newEntity, setNewEntity] = useState({ name: "", address: "", phone: "" });

  useEffect(() => {
    if (property) {
      setPropForm({
        name: property.name || "",
        address: property.address || "",
        phone: property.phone || "",
        email: property.email || "",
        whatsappNumber: property.whatsappNumber || "",
        whatsappBusinessId: property.whatsappBusinessId || "",
        whatsappAccessToken: property.whatsappAccessToken || ""
      });
    }
    if (gst) {
      setGstForm({
        gstin: gst.gstin || "",
        sacCode: gst.sacCode || "",
        roomGstRate: gst.roomGstRate?.toString() || "5",
        roomCgstRate: gst.roomCgstRate?.toString() || "2.5",
        roomSgstRate: gst.roomSgstRate?.toString() || "2.5",
        serviceGstRate: gst.serviceGstRate?.toString() || "18",
        serviceCgstRate: gst.serviceCgstRate?.toString() || "9",
        serviceSgstRate: gst.serviceSgstRate?.toString() || "9"
      });
    }
  }, [property, gst]);

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyRef || !isAdmin) return;
    await updateDoc(propertyRef, { ...propForm, updatedAt: new Date().toISOString() });
    toast({ title: "Property settings updated" });
  };

  const handleGstRateChange = (type: 'room' | 'service', value: string) => {
    const rate = parseFloat(value) || 0;
    const half = (rate / 2).toFixed(2);
    
    if (type === 'room') {
      setGstForm({
        ...gstForm,
        roomGstRate: value,
        roomCgstRate: half,
        roomSgstRate: half
      });
    } else {
      setGstForm({
        ...gstForm,
        serviceGstRate: value,
        serviceCgstRate: half,
        serviceSgstRate: half
      });
    }
  };

  const handleUpdateGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gstRef || !isAdmin) return;
    
    const updateData = {
      ...gstForm,
      roomGstRate: parseFloat(gstForm.roomGstRate),
      roomCgstRate: parseFloat(gstForm.roomCgstRate),
      roomSgstRate: parseFloat(gstForm.roomSgstRate),
      serviceGstRate: parseFloat(gstForm.serviceGstRate),
      serviceCgstRate: parseFloat(gstForm.serviceCgstRate),
      serviceSgstRate: parseFloat(gstForm.serviceSgstRate),
      entityId,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(gstRef, updateData, { merge: true });
      toast({ title: "Tax settings updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Update failed", description: "Check permissions." });
    }
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
    
    setEntityId(newId);
    setIsNewEntityOpen(false);
    setNewEntity({ name: "", address: "", phone: "" });
  };

  const handleThemeChange = (id: string) => {
    setTheme(id);
    toast({
      title: "Theme Updated",
      description: `Switched to ${THEMES.find(t => t.id === id)?.name}.`,
    });
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
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="profile">Property Profile</TabsTrigger>
            <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Gateway</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <CardTitle className="text-xl">Establishment Profile</CardTitle>
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
                    <Label>Reception Phone</Label>
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
                  <CardTitle className="text-xl">GST Configuration</CardTitle>
                </div>
                <CardDescription>Regional tax rates for room rent and monthly services.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateGst} className="space-y-8">
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

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-4 text-primary">Room Rent GST (Typical: 5%)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label>Total GST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.roomGstRate} 
                            onChange={e => handleGstRateChange('room', e.target.value)} 
                            disabled={!isAdmin} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CGST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.roomCgstRate} 
                            onChange={e => setGstForm({...gstForm, roomCgstRate: e.target.value})} 
                            disabled={!isAdmin} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SGST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.roomSgstRate} 
                            onChange={e => setGstForm({...gstForm, roomSgstRate: e.target.value})} 
                            disabled={!isAdmin} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-sm font-semibold mb-4 text-primary">Service / Monthly Rent GST (Typical: 18%)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label>Total GST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.serviceGstRate} 
                            onChange={e => handleGstRateChange('service', e.target.value)} 
                            disabled={!isAdmin} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CGST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.serviceCgstRate} 
                            onChange={e => setGstForm({...gstForm, serviceCgstRate: e.target.value})} 
                            disabled={!isAdmin} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SGST (%)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={gstForm.serviceSgstRate} 
                            onChange={e => setGstForm({...gstForm, serviceSgstRate: e.target.value})} 
                            disabled={!isAdmin} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <Button type="submit" className="shadow-md">
                      <Save className="w-4 h-4 mr-2" /> Save Tax Config
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <CardTitle className="text-xl">WhatsApp Gateway Config</CardTitle>
                </div>
                <CardDescription>Setup the official Meta Cloud API credentials for SUKHA OS.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProperty} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Property WhatsApp Number (Sender)</Label>
                      <Input placeholder="+91..." value={propForm.whatsappNumber} onChange={e => setPropForm({...propForm, whatsappNumber: e.target.value})} disabled={!isAdmin} />
                      <p className="text-[10px] text-muted-foreground">The verified number registered in Meta Developer Portal.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Business Account ID</Label>
                      <Input placeholder="WABA ID" value={propForm.whatsappBusinessId} onChange={e => setPropForm({...propForm, whatsappBusinessId: e.target.value})} disabled={!isAdmin} />
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-xl space-y-4 border border-dashed border-primary/20">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">Authentication</h4>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">System Access Token</Label>
                      <Input 
                        type="password" 
                        placeholder="Paste your Meta access token here" 
                        value={propForm.whatsappAccessToken} 
                        onChange={e => setPropForm({...propForm, whatsappAccessToken: e.target.value})}
                        disabled={!isAdmin} 
                        className="bg-white/50" 
                      />
                      <p className="text-[9px] text-primary font-medium italic">Tokens are managed securely via Firebase Environment Variables in production.</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <Button type="submit" className="shadow-md">
                      <Save className="w-4 h-4 mr-2" /> Save Gateway Settings
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  <CardTitle className="text-xl">Appearance & Theme</CardTitle>
                </div>
                <CardDescription>Choose a color scheme that matches your property branding.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {THEMES.map((t) => (
                    <div 
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={cn(
                        "group relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:border-primary bg-white shadow-sm",
                        (theme || 'default') === t.id ? "border-primary bg-primary/5" : "border-transparent"
                      )}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className={cn("h-12 w-12 rounded-full shadow-inner flex items-center justify-center", t.color)}>
                          {(theme || 'default') === t.id && <Check className="w-6 h-6 text-white" />}
                        </div>
                        <span className="text-xs font-bold text-center leading-tight">{t.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

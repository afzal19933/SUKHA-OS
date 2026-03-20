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

  const canEdit = currentUserRole === "admin";
  const canView = ["owner", "admin"].includes(currentUserRole || "");

  const propertyRef = useMemoFirebase(() => entityId ? doc(db, "hotel_properties", entityId) : null, [db, entityId]);
  const gstRef = useMemoFirebase(() => entityId ? doc(db, "hotel_properties", entityId, "gst_settings", "default") : null, [db, entityId]);

  const { data: property, isLoading: propLoading } = useDoc(propertyRef);
  const { data: gst, isLoading: gstLoading } = useDoc(gstRef);

  const [propForm, setPropForm] = useState({ name: "", address: "", phone: "", email: "", whatsappNumber: "", whatsappBusinessId: "", whatsappAccessToken: "" });
  const [gstForm, setGstForm] = useState({ gstin: "", sacCode: "", roomGstRate: "5", roomCgstRate: "2.5", roomSgstRate: "2.5", serviceGstRate: "18", serviceCgstRate: "9", serviceSgstRate: "9" });
  
  useEffect(() => {
    if (property) setPropForm({ name: property.name || "", address: property.address || "", phone: property.phone || "", email: property.email || "", whatsappNumber: property.whatsappNumber || "", whatsappBusinessId: property.whatsappBusinessId || "", whatsappAccessToken: property.whatsappAccessToken || "" });
    if (gst) setGstForm({ gstin: gst.gstin || "", sacCode: gst.sacCode || "", roomGstRate: gst.roomGstRate?.toString() || "5", roomCgstRate: gst.roomCgstRate?.toString() || "2.5", roomSgstRate: gst.roomSgstRate?.toString() || "2.5", serviceGstRate: gst.serviceGstRate?.toString() || "18", serviceCgstRate: gst.serviceCgstRate?.toString() || "9", serviceSgstRate: gst.serviceSgstRate?.toString() || "9" });
  }, [property, gst]);

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyRef || !canEdit) return;
    await updateDoc(propertyRef, { ...propForm, updatedAt: new Date().toISOString() });
    toast({ title: "Updated" });
  };

  const handleUpdateGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gstRef || !canEdit) return;
    await setDoc(gstRef, { ...gstForm, updatedAt: new Date().toISOString() }, { merge: true });
    toast({ title: "Tax settings updated" });
  };

  const handleThemeChange = (id: string) => {
    if (!canEdit) return;
    setTheme(id);
    toast({ title: "Theme Updated" });
  };

  if (propLoading || gstLoading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="profile">Property Profile</TabsTrigger>
            <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-none shadow-sm">
              <CardContent className="pt-6">
                <form onSubmit={handleUpdateProperty} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Business Name</Label><Input value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} disabled={!canEdit} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={propForm.email} onChange={e => setPropForm({...propForm, email: e.target.value})} disabled={!canEdit} /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} disabled={!canEdit} /></div>
                  {canEdit && <Button type="submit" className="mt-4"><Save className="w-4 h-4 mr-2" /> Save Profile</Button>}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <Card className="border-none shadow-sm">
              <CardContent className="pt-6">
                <form onSubmit={handleUpdateGst} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label>GSTIN</Label><Input value={gstForm.gstin} onChange={e => setGstForm({...gstForm, gstin: e.target.value})} disabled={!canEdit} /></div>
                    <div className="space-y-2"><Label>SAC</Label><Input value={gstForm.sacCode} onChange={e => setGstForm({...gstForm, sacCode: e.target.value})} disabled={!canEdit} /></div>
                  </div>
                  {canEdit && <Button type="submit"><Save className="w-4 h-4 mr-2" /> Save Tax Config</Button>}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {THEMES.map((t) => (
                <div key={t.id} onClick={() => handleThemeChange(t.id)} className={cn("cursor-pointer rounded-2xl border-2 p-4 transition-all", (theme || 'default') === t.id ? "border-primary bg-primary/5" : "border-transparent")}>
                  <div className="flex flex-col items-center gap-3"><div className={cn("h-12 w-12 rounded-full", t.color)}></div><span className="text-xs font-bold">{t.name}</span></div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Loader2, Save, Building, Percent, Plus, Palette, Check, MessageSquare, Key, Database, Globe, Phone, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const THEMES = [
  { id: 'default', name: 'Sukha Indigo', color: 'bg-[#5F5FA7]' },
  { id: 'emerald', name: 'Forest Emerald', color: 'bg-[#10b981]' },
  { id: 'rose', name: 'Royal Rose', color: 'bg-[#e11d48]' },
  { id: 'amber', name: 'Golden Amber', color: 'bg-[#f59e0b]' },
  { id: 'slate', name: 'Slate Professional', color: 'bg-[#334155]' },
];

function SettingsContent() {
  const { entityId, role: currentUserRole, theme, setTheme } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const canEdit = currentUserRole === "admin";

  const propertyRef = useMemoFirebase(() => entityId ? doc(db, "hotel_properties", entityId) : null, [db, entityId]);
  const gstRef = useMemoFirebase(() => entityId ? doc(db, "hotel_properties", entityId, "gst_settings", "default") : null, [db, entityId]);

  const { data: property, isLoading: propLoading } = useDoc(propertyRef);
  const { data: gst, isLoading: gstLoading } = useDoc(gstRef);

  const [propForm, setPropForm] = useState({ 
    name: "", 
    address: "", 
    phone: "", 
    email: "", 
    whatsappNumber: "", 
    whatsappPhoneNumberId: "",
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
  
  useEffect(() => {
    if (property) setPropForm({ 
      name: property.name || "", 
      address: property.address || "", 
      phone: property.phone || "", 
      email: property.email || "", 
      whatsappNumber: property.whatsappNumber || "", 
      whatsappPhoneNumberId: property.whatsappPhoneNumberId || "",
      whatsappBusinessId: property.whatsappBusinessId || "", 
      whatsappAccessToken: property.whatsappAccessToken || "" 
    });
    if (gst) setGstForm({ 
      gstin: gst.gstin || "", 
      sacCode: gst.sacCode || "", 
      roomGstRate: gst.roomGstRate?.toString() || "5", 
      roomCgstRate: gst.roomCgstRate?.toString() || "2.5", 
      roomSgstRate: gst.roomSgstRate?.toString() || "2.5", 
      serviceGstRate: gst.serviceGstRate?.toString() || "18", 
      serviceCgstRate: gst.serviceCgstRate?.toString() || "9", 
      serviceSgstRate: gst.serviceSgstRate?.toString() || "9" 
    });
  }, [property, gst]);

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyRef || !canEdit) return;
    await updateDoc(propertyRef, { ...propForm, updatedAt: new Date().toISOString() });
    toast({ title: "Configuration Saved", description: "Property profile and gateway settings updated." });
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

  if (propLoading || gstLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  // Get dynamic origin for instructions
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">System Settings</h1>
      
      <Tabs defaultValue={activeTab} className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-2xl shadow-sm h-12">
          <TabsTrigger value="profile" className="rounded-xl h-10 px-6 text-[11px] font-bold uppercase">Property Profile</TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl h-10 px-6 text-[11px] font-bold uppercase flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Gateway
          </TabsTrigger>
          <TabsTrigger value="tax" className="rounded-xl h-10 px-6 text-[11px] font-bold uppercase">Tax & Billing</TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-xl h-10 px-6 text-[11px] font-bold uppercase">Appearance</TabsTrigger>
          {currentUserRole === 'admin' && (
            <TabsTrigger value="backup" onClick={() => router.push('/settings/backup')} className="rounded-xl h-10 px-6 text-[11px] font-black uppercase text-primary">
              <Database className="w-3.5 h-3.5 mr-2" /> Backup & Restore
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-secondary/30">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Legal Entity Details</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">Public identity and contact records</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <form onSubmit={handleUpdateProperty} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Business Name</Label>
                    <Input value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} disabled={!canEdit} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Official Email</Label>
                    <Input type="email" value={propForm.email} onChange={e => setPropForm({...propForm, email: e.target.value})} disabled={!canEdit} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Physical Address</Label>
                  <Input value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} disabled={!canEdit} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                </div>
                {canEdit && <Button type="submit" className="h-11 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg"><Save className="w-4 h-4 mr-2" /> Commit Profile Changes</Button>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="grid grid-cols-1 gap-6">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-emerald-50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Meta Cloud API Configuration
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-emerald-600/70">Establish live communication with guests via Meta Gateway</CardDescription>
              </CardHeader>
              <CardContent className="pt-8">
                <form onSubmit={handleUpdateProperty} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Display Sender Number</Label>
                        <Input 
                          placeholder="+91..." 
                          value={propForm.whatsappNumber} 
                          onChange={e => setPropForm({...propForm, whatsappNumber: e.target.value})} 
                          disabled={!canEdit} 
                          className="h-11 rounded-xl bg-secondary/50 border-none font-bold" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Phone Number ID</Label>
                        <Input 
                          placeholder="From Meta Dashboard" 
                          value={propForm.whatsappPhoneNumberId} 
                          onChange={e => setPropForm({...propForm, whatsappPhoneNumberId: e.target.value})} 
                          disabled={!canEdit} 
                          className="h-11 rounded-xl bg-secondary/50 border-none font-bold" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">WhatsApp Business Account ID</Label>
                        <Input 
                          placeholder="From Meta Dashboard" 
                          value={propForm.whatsappBusinessId} 
                          onChange={e => setPropForm({...propForm, whatsappBusinessId: e.target.value})} 
                          disabled={!canEdit} 
                          className="h-11 rounded-xl bg-secondary/50 border-none font-bold" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <Key className="w-4 h-4" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">System Access Token</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase text-emerald-600/70">Permanent Graph API Token</Label>
                          <textarea 
                            value={propForm.whatsappAccessToken} 
                            onChange={e => setPropForm({...propForm, whatsappAccessToken: e.target.value})} 
                            disabled={!canEdit} 
                            className="w-full h-32 p-4 text-[10px] font-mono rounded-2xl bg-white border-emerald-100 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="EAAG..."
                          />
                        </div>
                        <p className="text-[8px] text-emerald-600 font-bold uppercase leading-relaxed">
                          Note: Use a permanent system user token from your Meta App Dashboard. Ensure the token has 'whatsapp_business_messaging' permissions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-emerald-600">Gateway Status: Ready for Sync</span>
                      </div>
                      <Button type="submit" className="h-12 px-10 font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700">
                        Authorize Gateway
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem] bg-indigo-50 border border-indigo-100">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-black uppercase text-indigo-900 tracking-tight">Webhook Configuration</h3>
                      <p className="text-xs font-bold text-indigo-700/70 uppercase tracking-widest mt-1">Setup live automation in Meta Dashboard</p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-indigo-900 uppercase">1. Callback URL</p>
                      <code className="block p-3 bg-white rounded-xl border border-indigo-200 text-xs font-mono text-indigo-600 select-all">
                        {origin}/api/whatsapp/webhook
                      </code>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-indigo-900 uppercase">2. Verify Token</p>
                      <code className="block p-3 bg-white rounded-xl border border-indigo-200 text-xs font-mono text-indigo-600 select-all">
                        sukha_os_verify
                      </code>
                    </div>

                    <div className="p-4 bg-white/50 rounded-2xl">
                      <p className="text-[9px] font-bold text-indigo-800 leading-relaxed uppercase">
                        Instructions: Go to Meta App Dashboard → WhatsApp → Configuration. 
                        Enter the URL and Token above. Click "Verify and Save". 
                        Then under "Webhook fields", subscribe to <span className="font-black">messages</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tax">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-secondary/30">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Compliance Configuration</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold">GST, SAC, and standardized taxation rates</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <form onSubmit={handleUpdateGst} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">GSTIN Identifier</Label>
                    <Input value={gstForm.gstin} onChange={e => setGstForm({...gstForm, gstin: e.target.value})} disabled={!canEdit} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Primary SAC Code</Label>
                    <Input value={gstForm.sacCode} onChange={e => setGstForm({...gstForm, sacCode: e.target.value})} disabled={!canEdit} className="h-11 rounded-xl bg-secondary/50 border-none font-bold" />
                  </div>
                </div>
                {canEdit && <Button type="submit" className="h-11 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg"><Save className="w-4 h-4 mr-2" /> Save Compliance Settings</Button>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {THEMES.map((t) => (
              <div 
                key={t.id} 
                onClick={() => handleThemeChange(t.id)} 
                className={cn(
                  "cursor-pointer rounded-[2rem] border-2 p-6 transition-all hover:scale-105", 
                  (theme || 'default') === t.id ? "border-primary bg-primary/5 shadow-xl" : "border-transparent bg-white shadow-sm"
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className={cn("h-16 w-16 rounded-3xl shadow-inner", t.color)}></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.name}</span>
                  {(theme || 'default') === t.id && <Check className="w-4 h-4 text-primary" />}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}>
        <SettingsContent />
      </Suspense>
    </AppLayout>
  );
}

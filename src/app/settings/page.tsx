
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, collection, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Building, Percent, ShieldCheck, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const SYSTEM_MODULES = [
  "Reservations",
  "Rooms",
  "Housekeeping",
  "Maintenance",
  "Laundry",
  "Invoices",
  "Team",
];

export default function SettingsPage() {
  const { entityId, role } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const gstRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId, "gst_settings", "default");
  }, [db, entityId]);

  const teamQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "user_profiles"), where("entityId", "==", entityId));
  }, [db, entityId]);

  const { data: property, isLoading: propLoading } = useDoc(propertyRef);
  const { data: gst, isLoading: gstLoading } = useDoc(gstRef);
  const { data: teamMembers, isLoading: teamLoading } = useCollection(teamQuery);

  const [propForm, setPropForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [gstForm, setGstForm] = useState({ gstin: "", sacCode: "", gstRate: "12", cgstRate: "6", sgstRate: "6" });
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

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
    if (!propertyRef) return;
    await updateDoc(propertyRef, { ...propForm, updatedAt: new Date().toISOString() });
    toast({ title: "Property updated successfully" });
  };

  const handleUpdateGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gstRef) return;
    await updateDoc(gstRef, {
      ...gstForm,
      gstRate: parseFloat(gstForm.gstRate),
      cgstRate: parseFloat(gstForm.cgstRate),
      sgstRate: parseFloat(gstForm.sgstRate),
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Tax settings updated" });
  };

  const togglePermission = async (userId: string, moduleName: string) => {
    const user = teamMembers?.find(m => m.id === userId);
    if (!user) return;

    const currentPermissions = user.permissions || SYSTEM_MODULES; // Default to all if not set
    let newPermissions: string[];

    if (currentPermissions.includes(moduleName)) {
      newPermissions = currentPermissions.filter((p: string) => p !== moduleName);
    } else {
      newPermissions = [...currentPermissions, moduleName];
    }

    const userRef = doc(db, "user_profiles", userId);
    await updateDoc(userRef, { 
      permissions: newPermissions,
      updatedAt: new Date().toISOString() 
    });
    
    toast({ title: `Updated access for ${user.name}` });
  };

  if (propLoading || gstLoading) {
    return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></AppLayout>;
  }

  const isAdmin = role === "owner" || role === "admin";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure property profile and team access control</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="profile">Property Profile</TabsTrigger>
            <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
            {isAdmin && <TabsTrigger value="permissions">Team Permissions</TabsTrigger>}
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
                      <Input value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input type="email" value={propForm.email} onChange={e => setPropForm({...propForm, email: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={propForm.address} onChange={e => setPropForm({...propForm, address: e.target.value})} />
                  </div>
                  <div className="space-y-2 w-full md:w-1/2">
                    <Label>Phone Number</Label>
                    <Input value={propForm.phone} onChange={e => setPropForm({...propForm, phone: e.target.value})} />
                  </div>
                  <Button type="submit" className="mt-4 shadow-md">
                    <Save className="w-4 h-4 mr-2" /> Save Profile
                  </Button>
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
                      <Input placeholder="Enter GSTIN" value={gstForm.gstin} onChange={e => setGstForm({...gstForm, gstin: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>SAC Code</Label>
                      <Input placeholder="9963" value={gstForm.sacCode} onChange={e => setGstForm({...gstForm, sacCode: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Overall GST (%)</Label>
                      <Input type="number" value={gstForm.gstRate} onChange={e => setGstForm({...gstForm, gstRate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>CGST (%)</Label>
                      <Input type="number" value={gstForm.cgstRate} onChange={e => setGstForm({...gstForm, cgstRate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>SGST (%)</Label>
                      <Input type="number" value={gstForm.sgstRate} onChange={e => setGstForm({...gstForm, sgstRate: e.target.value})} />
                    </div>
                  </div>
                  <Button type="submit" className="shadow-md">
                    <Save className="w-4 h-4 mr-2" /> Update Tax Config
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="permissions">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Staff List</CardTitle>
                    <CardDescription>Select a user to modify access.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[500px] overflow-y-auto">
                      {teamMembers?.map(member => (
                        <div 
                          key={member.id}
                          className={cn(
                            "flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors",
                            selectedStaff === member.id && "bg-secondary"
                          )}
                          onClick={() => setSelectedStaff(member.id)}
                        >
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2 border-none shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Module Access</CardTitle>
                    </div>
                    <CardDescription>
                      {selectedStaff 
                        ? `Configure what ${teamMembers?.find(m => m.id === selectedStaff)?.name} can see.`
                        : "Select a staff member from the left to manage permissions."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedStaff ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {SYSTEM_MODULES.map(moduleName => {
                            const staff = teamMembers?.find(m => m.id === selectedStaff);
                            const hasAccess = staff?.permissions?.includes(moduleName) ?? true;
                            const isProtected = staff?.role === 'owner'; // Owner can't be restricted

                            return (
                              <div key={moduleName} className="flex items-center space-x-3 p-4 bg-secondary/30 rounded-xl border">
                                <Checkbox 
                                  id={`module-${moduleName}`}
                                  checked={hasAccess || isProtected}
                                  disabled={isProtected}
                                  onCheckedChange={() => togglePermission(selectedStaff, moduleName)}
                                />
                                <Label 
                                  htmlFor={`module-${moduleName}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {moduleName}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                        {teamMembers?.find(m => m.id === selectedStaff)?.role === 'owner' && (
                          <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-sm">
                            Owners have full system access by default. These settings cannot be restricted.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-secondary/20 rounded-2xl border border-dashed">
                        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">Select a member to view or change their system access.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

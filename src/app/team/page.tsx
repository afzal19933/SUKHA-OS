
"use client";

import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  UserPlus, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Loader2,
  ShieldAlert,
  Eye,
  EyeOff,
  Lock,
  Building2,
  UserCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useUser } from "@/firebase";
import { collection, query, where, doc, setDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

const SYSTEM_MODULES = [
  "Reservations", "Rooms", "Inventory", "Housekeeping", "Maintenance", 
  "Laundry", "Accounting", "Team", "Settings"
];

export default function TeamPage() {
  const { role: currentUserRole, entityId, availableProperties } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newMember, setNewMember] = useState({ 
    name: "", 
    username: "", 
    role: "staff",
    password: "",
    targetEntityId: entityId || (availableProperties.length > 0 ? availableProperties[0].id : "")
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // isAdmin strictly refers to Global Master
  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    // Restore pointer events manually if a dialog gets stuck
    if (!isEditOpen && !isPermissionsOpen && !isInviteOpen) {
      setTimeout(() => { document.body.style.pointerEvents = "auto"; }, 300);
    }
  }, [isEditOpen, isPermissionsOpen, isInviteOpen]);

  const teamQuery = useMemoFirebase(() => {
    // Master Admins see everyone
    if (isAdmin) return query(collection(db, "user_profiles"));
    // Owners/Managers see only their assigned staff
    return query(collection(db, "user_profiles"), where("entityId", "==", entityId));
  }, [db, entityId, isAdmin]);

  const { data: teamMembers, isLoading } = useCollection(teamQuery);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return; 
    
    setIsSubmitting(true);
    try {
      const secondaryAppName = `Provisioner-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const internalEmail = `${newMember.username.toLowerCase().trim()}@sukha.os`;
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, newMember.password);
      const newUser = userCredential.user;

      const memberData = {
        id: newUser.uid,
        entityId: newMember.targetEntityId,
        name: newMember.name,
        email: internalEmail,
        role: newMember.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: SYSTEM_MODULES
      };

      await setDoc(doc(db, "user_profiles", newUser.uid), memberData);

      toast({ title: "Account Created", description: `${newMember.name} provisioned as ${newMember.role}.` });
      setIsInviteOpen(false);
      setNewMember({ name: "", username: "", role: "staff", password: "", targetEntityId: entityId || "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Provisioning Error", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !isAdmin) return;
    updateDocumentNonBlocking(doc(db, "user_profiles", editingMember.id), {
      name: editingMember.name,
      role: editingMember.role,
      isActive: editingMember.isActive,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Profile updated" });
    setIsEditOpen(false);
  };

  const togglePermission = (userId: string, moduleName: string) => {
    if (!isAdmin) return;
    const member = teamMembers?.find(m => m.id === userId);
    if (!member) return;

    const currentPermissions = member.permissions || [];
    const newPermissions = currentPermissions.includes(moduleName)
      ? currentPermissions.filter((p: string) => p !== moduleName)
      : [...currentPermissions, moduleName];

    updateDocumentNonBlocking(doc(db, "user_profiles", userId), { 
      permissions: newPermissions,
      updatedAt: new Date().toISOString() 
    });
    toast({ title: "Access updated" });
  };

  const filteredMembers = teamMembers?.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Staff & Owner Registry</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-0.5">Master Administrative Control Panel</p>
          </div>
          
          <div className="flex items-center gap-2">
            {!isAdmin && (
              <div className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 flex items-center gap-2 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-wider">Restricted View Only</span>
              </div>
            )}
            {isAdmin && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <Button className="h-10 shadow-xl bg-primary hover:bg-primary/90 px-6 font-black text-[10px] uppercase tracking-widest text-white rounded-xl" onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" /> Register New Account
                </Button>
                <DialogContent className="sm:max-w-[400px] text-left rounded-[2.5rem]">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black uppercase text-primary">Provision Member</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase">Assign a specific entity and functional role.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Full Name</Label>
                      <Input placeholder="Member Name" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} required className="h-11 text-xs rounded-xl bg-secondary/30 border-none" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Assign Entity Access</Label>
                      <Select value={newMember.targetEntityId} onValueChange={(val) => setNewMember({...newMember, targetEntityId: val})}>
                        <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/30 border-none"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableProperties.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-[11px] font-bold uppercase">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Username</Label>
                        <Input placeholder="login_id" value={newMember.username} onChange={(e) => setNewMember({...newMember, username: e.target.value})} required className="h-11 text-xs rounded-xl bg-secondary/30 border-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Functional Role</Label>
                        <Select value={newMember.role} onValueChange={(val) => setNewMember({...newMember, role: val})}>
                          <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/30 border-none"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin" className="text-xs font-bold">Admin (Global Master)</SelectItem>
                            <SelectItem value="owner" className="text-xs font-bold">Owner (View Only)</SelectItem>
                            <SelectItem value="manager" className="text-xs font-bold">Manager</SelectItem>
                            <SelectItem value="staff" className="text-xs font-bold">Operational Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Access Password</Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Min 6 characters" 
                          value={newMember.password} 
                          onChange={(e) => setNewMember({...newMember, password: e.target.value})} 
                          required 
                          className="h-11 text-xs rounded-xl bg-secondary/30 border-none pr-10" 
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-[11px] font-black uppercase tracking-widest shadow-xl rounded-2xl mt-4" disabled={isSubmitting}>
                      {isSubmitting ? "Generating Login..." : "Provision Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Filter registry by name or email..." className="pl-10 h-10 text-xs bg-white rounded-xl border-none shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-black uppercase h-12 pl-8 text-primary-foreground">Member Account</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Entity Access</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Assigned Role</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase h-12 pr-8 text-primary-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="group border-b border-secondary/50 hover:bg-primary/5 transition-colors">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-[12px] font-black shadow-inner">
                          {member.name?.charAt(0) || "U"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-[12px] uppercase tracking-tight">{member.name}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{member.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold bg-secondary/50 border-none px-2.5 py-1 rounded-lg">
                        {availableProperties.find(p => p.id === member.entityId)?.name || "Global Access"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "font-black text-[9px] h-5 px-2 bg-white",
                        member.role === 'admin' ? "border-indigo-500 text-indigo-600" : 
                        member.role === 'owner' ? "border-amber-500 text-amber-600" : "border-primary/10 text-primary"
                      )}>
                        {member.role === 'admin' ? "Master Admin" : member.role === 'owner' ? "Owner (View Only)" : member.role?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {member.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{member.isActive ? "Active" : "Disabled"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-white hover:shadow-md rounded-xl">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl z-[150]">
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditOpen(true); }} className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5 mr-3 text-primary" /> Modify Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsPermissionsOpen(true); }} className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer">
                              <Lock className="w-3.5 h-3.5 mr-3 text-amber-600" /> Module Access
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50" onClick={() => deleteDocumentNonBlocking(doc(db, "user_profiles", member.id))}>
                              <Trash2 className="w-3.5 h-3.5 mr-3" /> Terminate Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registry is currently empty</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="sm:max-w-[360px] text-left rounded-[2.5rem]">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase text-primary">Module Access: {editingMember?.name}</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Owners remain View-Only regardless of module access.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {SYSTEM_MODULES.map(moduleName => {
                const hasAccess = editingMember?.permissions?.includes(moduleName);
                return (
                  <div key={moduleName} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-transparent hover:border-primary/10 transition-colors">
                    <Label htmlFor={`perm-${moduleName}`} className="text-[11px] font-black uppercase tracking-tight cursor-pointer">{moduleName}</Label>
                    <Checkbox id={`perm-${moduleName}`} checked={hasAccess} onCheckedChange={() => togglePermission(editingMember.id, moduleName)} />
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setIsPermissionsOpen(false)} className="w-full h-12 text-[11px] font-black uppercase tracking-widest rounded-2xl bg-secondary text-primary">Close Control Panel</Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

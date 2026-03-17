
"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  UserPlus, 
  Shield, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  Check,
  Users
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
import { collection, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

const SYSTEM_MODULES = [
  "Reservations",
  "Rooms",
  "Housekeeping",
  "Maintenance",
  "Laundry",
  "Invoices",
  "Team",
];

export default function TeamPage() {
  const { entityId, role: currentUserRole, setEntityId, setRole, setPermissions } = useAuthStore();
  const { user: firebaseUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newMember, setNewMember] = useState({ name: "", username: "", role: "staff" });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  const teamQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "user_profiles"), where("entityId", "==", entityId));
  }, [db, entityId]);

  const { data: teamMembers, isLoading } = useCollection(teamQuery);

  const handleResync = async () => {
    if (!firebaseUser) return;
    setIsResyncing(true);
    try {
      const docRef = doc(db, "user_profiles", firebaseUser.uid);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        const data = snap.data();
        if (data.entityId) setEntityId(data.entityId);
        if (data.role) setRole(data.role);
        if (data.permissions) setPermissions(data.permissions);
        toast({ title: "Session Resynced", description: "Property context loaded successfully." });
      } else if (firebaseUser.email?.startsWith('admin')) {
        const hotelId = crypto.randomUUID();
        const newProfile = {
          id: firebaseUser.uid,
          entityId: hotelId,
          name: firebaseUser.displayName || "Administrator",
          email: firebaseUser.email,
          isActive: true,
          role: "owner",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          permissions: ["Dashboard", "Reservations", "Rooms", "Housekeeping", "Maintenance", "Laundry", "Invoices", "Team"]
        };
        
        await setDoc(docRef, newProfile);
        
        await setDoc(doc(db, "hotel_properties", hotelId), {
          id: hotelId,
          entityId: hotelId,
          name: "Sukha Retreats",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setEntityId(hotelId);
        setRole("owner");
        setPermissions(newProfile.permissions);
        
        toast({ title: "Profile Initialized", description: "Default property and owner profile created." });
      } else {
        toast({ variant: "destructive", title: "Resync Failed", description: "Profile document not found." });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Resync Error", description: "Could not refresh profile." });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !isAdmin) {
      toast({ variant: "destructive", title: "Access Denied", description: "Only admins can add members." });
      return;
    }
    setIsSubmitting(true);
    try {
      const internalEmail = `${newMember.username.toLowerCase().trim()}@sukha.os`;
      const tempId = crypto.randomUUID();
      const memberRef = doc(db, "user_profiles", tempId);
      
      const memberData = {
        id: tempId,
        entityId: entityId,
        name: newMember.name,
        email: internalEmail,
        role: newMember.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ["Dashboard", "Reservations", "Rooms", "Housekeeping"] // Default base modules
      };

      setDocumentNonBlocking(memberRef, memberData, { merge: true });
      toast({ title: "Member Created", description: `${newMember.name} has been added to the registry.` });
      setIsInviteOpen(false);
      setNewMember({ name: "", username: "", role: "staff" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create profile." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !editingMember || !isAdmin) return;
    const memberRef = doc(db, "user_profiles", editingMember.id);
    updateDocumentNonBlocking(memberRef, {
      name: editingMember.name,
      role: editingMember.role,
      isActive: editingMember.isActive,
      updatedAt: new Date().toISOString()
    });
    toast({ title: "Profile updated" });
    setIsEditOpen(false);
    setEditingMember(null);
  };

  const togglePermission = (userId: string, moduleName: string) => {
    if (!isAdmin) return;
    const member = teamMembers?.find(m => m.id === userId);
    if (!member || member.role === 'owner') return;

    const currentPermissions = member.permissions || [];
    let newPermissions: string[];
    if (currentPermissions.includes(moduleName)) {
      newPermissions = currentPermissions.filter((p: string) => p !== moduleName);
    } else {
      newPermissions = [...currentPermissions, moduleName];
    }

    const memberRef = doc(db, "user_profiles", userId);
    updateDocumentNonBlocking(memberRef, { 
      permissions: newPermissions,
      updatedAt: new Date().toISOString() 
    });
    
    toast({ title: "Access updated" });
  };

  const handleDeleteMember = (member: any) => {
    if (!isAdmin) return;
    if (member.role === 'owner') {
      toast({ variant: "destructive", title: "Action denied", description: "Owner account cannot be deleted." });
      return;
    }
    deleteDocumentNonBlocking(doc(db, "user_profiles", member.id));
    toast({ title: "Member deleted" });
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
            <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Team Registry</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-0.5">Staff Roles & System Access Control</p>
          </div>
          
          <div className="flex items-center gap-2">
            {!entityId && (
              <Button variant="outline" size="sm" onClick={handleResync} disabled={isResyncing} className="h-10 px-4 rounded-xl">
                <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isResyncing && "animate-spin")} />
                Resync Session
              </Button>
            )}
            {isAdmin && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 shadow-xl bg-primary hover:bg-primary/90 px-6 font-black text-[10px] uppercase tracking-widest text-white rounded-xl">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[360px] text-left rounded-[2rem]">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black uppercase text-primary">New Team Member</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase">Setup a profile for housekeeping or management staff.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-[10px] uppercase font-black text-muted-foreground">Full Name</Label>
                      <Input id="name" placeholder="John Doe" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} required className="h-11 text-xs rounded-xl bg-secondary/30 border-none" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-[10px] uppercase font-black text-muted-foreground">Internal Username</Label>
                      <Input id="username" placeholder="johndoe" value={newMember.username} onChange={(e) => setNewMember({...newMember, username: e.target.value})} required className="h-11 text-xs rounded-xl bg-secondary/30 border-none" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="role" className="text-[10px] uppercase font-black text-muted-foreground">Functional Role</Label>
                      <Select value={newMember.role} onValueChange={(val) => setNewMember({...newMember, role: val})}>
                        <SelectTrigger id="role" className="h-11 text-xs rounded-xl bg-secondary/30 border-none"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="text-xs font-bold">Admin</SelectItem>
                          <SelectItem value="manager" className="text-xs font-bold">Manager</SelectItem>
                          <SelectItem value="supervisor" className="text-xs font-bold">Supervisor</SelectItem>
                          <SelectItem value="staff" className="text-xs font-bold">Staff (Housekeeping)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full h-12 text-[11px] font-black uppercase tracking-widest shadow-lg rounded-2xl mt-4" disabled={isSubmitting || !entityId}>
                      {isSubmitting ? "Processing..." : "Confirm & Save Member"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Filter by name or email..." className="pl-10 h-10 text-xs bg-white rounded-xl border-none shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-black uppercase h-12 pl-8 text-primary-foreground">Member</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">ID / Username</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Role</TableHead>
                <TableHead className="text-[10px] font-black uppercase h-12 text-primary-foreground">Account Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase h-12 pr-8 text-primary-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="group border-b border-secondary/50 hover:bg-primary/5 transition-colors">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-3 py-2">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-[11px] font-black shadow-inner">
                          {member.name?.charAt(0) || "U"}
                        </div>
                        <span className="font-black text-[12px] uppercase tracking-tight">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-[10px] font-mono bg-secondary px-2 py-1 rounded-lg text-muted-foreground font-bold">{member.email?.split('@')[0]}</span></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-black text-[9px] h-5 px-2 bg-white border-primary/10 text-primary">
                        {member.role?.replace('_', ' ') || "Staff"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {member.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{member.isActive ? "Active" : "Locked"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      {isAdmin && member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-white hover:shadow-md rounded-xl">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl">
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditOpen(true); }} className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5 mr-3 text-primary" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsPermissionsOpen(true); }} className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer">
                              <Lock className="w-3.5 h-3.5 mr-3 text-amber-600" /> System Access
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase p-3 rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteMember(member)}>
                              <Trash2 className="w-3.5 h-3.5 mr-3" /> Terminate Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-24 text-[10px] font-black uppercase text-muted-foreground tracking-widest">No members matching current criteria</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Member Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[340px] text-left rounded-[2rem]">
            <DialogHeader><DialogTitle className="text-sm font-black uppercase text-primary">Modify Member</DialogTitle></DialogHeader>
            {editingMember && (
              <form onSubmit={handleUpdateMember} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Full Name</Label>
                  <Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} required className="h-11 text-xs rounded-xl bg-secondary/30 border-none" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Assigned Role</Label>
                  <Select value={editingMember.role} onValueChange={(val) => setEditingMember({...editingMember, role: val})}>
                    <SelectTrigger className="h-11 text-xs rounded-xl bg-secondary/30 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin" className="text-xs font-bold">Admin</SelectItem>
                      <SelectItem value="manager" className="text-xs font-bold">Manager</SelectItem>
                      <SelectItem value="staff" className="text-xs font-bold">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-3 pt-2 bg-secondary/20 p-3 rounded-xl">
                  <Checkbox id="active-edit" checked={editingMember.isActive} onCheckedChange={(val) => setEditingMember({...editingMember, isActive: !!val})} />
                  <Label htmlFor="active-edit" className="text-[10px] font-black uppercase cursor-pointer">Account Status: Active</Label>
                </div>
                <Button type="submit" className="w-full h-12 text-[11px] font-black uppercase tracking-widest shadow-xl rounded-2xl mt-4">Save Profile Changes</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="sm:max-w-[340px] text-left rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase text-primary">Module Authorization</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Assign accessible modules for {editingMember?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {SYSTEM_MODULES.map(moduleName => {
                const hasAccess = editingMember?.permissions?.includes(moduleName);
                return (
                  <div key={moduleName} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-transparent hover:border-primary/10 transition-colors">
                    <Label htmlFor={`perm-${moduleName}`} className="text-[11px] font-black uppercase tracking-tight cursor-pointer">{moduleName}</Label>
                    <Checkbox 
                      id={`perm-${moduleName}`}
                      checked={hasAccess}
                      onCheckedChange={() => {
                        togglePermission(editingMember.id, moduleName);
                        const updatedPerms = hasAccess 
                          ? editingMember.permissions.filter((p: string) => p !== moduleName)
                          : [...(editingMember.permissions || []), moduleName];
                        setEditingMember({...editingMember, permissions: updatedPerms});
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setIsPermissionsOpen(false)} className="w-full h-12 text-[11px] font-black uppercase tracking-widest rounded-2xl bg-secondary text-primary hover:bg-secondary/80">Close Control Panel</Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}


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
  Check
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
      toast({ title: "Member Created", description: `${newMember.name} has been added.` });
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
            <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">Team Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage staff roles and system access</p>
          </div>
          
          <div className="flex items-center gap-2">
            {!entityId && (
              <Button variant="outline" size="sm" onClick={handleResync} disabled={isResyncing} className="h-9 px-3">
                <RefreshCw className={cn("w-3 h-3 mr-2", isResyncing && "animate-spin")} />
                Resync
              </Button>
            )}
            {isAdmin && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button className="h-9 shadow-md bg-primary hover:bg-primary/90 px-4 font-semibold text-xs text-white">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[340px] text-left">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Add New Member</DialogTitle>
                    <DialogDescription className="text-xs">Create a new staff profile.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs">Full Name</Label>
                      <Input id="name" placeholder="Jane Smith" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} required className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs">Username</Label>
                      <Input id="username" placeholder="janesmith" value={newMember.username} onChange={(e) => setNewMember({...newMember, username: e.target.value})} required className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="role" className="text-xs">Role</Label>
                      <Select value={newMember.role} onValueChange={(val) => setNewMember({...newMember, role: val})}>
                        <SelectTrigger id="role" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full h-9 text-xs font-bold mt-2" disabled={isSubmitting || !entityId}>
                      {isSubmitting ? "Processing..." : "Create Profile"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search team..." className="pl-9 h-9 text-xs bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-bold uppercase h-12 text-primary-foreground">Member</TableHead>
                <TableHead className="text-[10px] font-bold uppercase h-12 text-primary-foreground">Username</TableHead>
                <TableHead className="text-[10px] font-bold uppercase h-12 text-primary-foreground">Role</TableHead>
                <TableHead className="text-[10px] font-bold uppercase h-12 text-primary-foreground">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase h-12 pr-4 text-primary-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="group border-b border-secondary/50">
                    <TableCell>
                      <div className="flex items-center gap-2.5 py-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">{member.name?.charAt(0) || "U"}</div>
                        <span className="font-semibold text-[11px]">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{member.email?.split('@')[0]}</span></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-medium text-[9px] h-4">
                        {member.role?.replace('_', ' ') || "Staff"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {member.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span className="text-[10px] font-medium">{member.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {isAdmin && member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditOpen(true); }} className="text-xs"><Edit2 className="w-3.5 h-3.5 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsPermissionsOpen(true); }} className="text-xs"><Lock className="w-3.5 h-3.5 mr-2" /> Access</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive text-xs" onClick={() => handleDeleteMember(member)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[11px] text-muted-foreground">No members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[340px] text-left">
            <DialogHeader><DialogTitle className="text-sm">Edit Member</DialogTitle></DialogHeader>
            {editingMember && (
              <form onSubmit={handleUpdateMember} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} required className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Select value={editingMember.role} onValueChange={(val) => setEditingMember({...editingMember, role: val})}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox id="active-edit" checked={editingMember.isActive} onCheckedChange={(val) => setEditingMember({...editingMember, isActive: !!val})} />
                  <Label htmlFor="active-edit" className="text-xs">Account Active</Label>
                </div>
                <Button type="submit" className="w-full h-9 text-xs font-bold mt-2">Save Changes</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="sm:max-w-[340px] text-left">
            <DialogHeader>
              <DialogTitle className="text-sm">Access Control</DialogTitle>
              <DialogDescription className="text-xs">Module assignment for {editingMember?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {SYSTEM_MODULES.map(moduleName => {
                const hasAccess = editingMember?.permissions?.includes(moduleName);
                return (
                  <div key={moduleName} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg border">
                    <Label htmlFor={`perm-${moduleName}`} className="text-[11px] font-semibold cursor-pointer">{moduleName}</Label>
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
            <Button onClick={() => setIsPermissionsOpen(false)} className="w-full h-9 text-xs mt-2">Done</Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

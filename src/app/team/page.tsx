
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
          name: "Sukha Grand Property",
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
    if (!entityId) {
      toast({ variant: "destructive", title: "Configuration Error", description: "Property context not loaded. Try Resync." });
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
    if (!entityId || !editingMember) return;
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
    if (member.role === 'owner') {
      toast({ variant: "destructive", title: "Action denied", description: "Owner account cannot be deleted." });
      return;
    }
    deleteDocumentNonBlocking(doc(db, "user_profiles", member.id));
    toast({ title: "Member deleted" });
  };

  const isAdmin = ["owner", "admin", "manager", "supervisor"].includes(currentUserRole || "") || 
                  firebaseUser?.displayName === "Administrator" ||
                  !currentUserRole;

  const filteredMembers = teamMembers?.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
            <p className="text-muted-foreground mt-1">Manage staff roles, system access, and profiles</p>
          </div>
          
          <div className="flex items-center gap-2">
            {!entityId && (
              <Button variant="outline" onClick={handleResync} disabled={isResyncing} className="h-11 px-4">
                <RefreshCw className={cn("w-4 h-4 mr-2", isResyncing && "animate-spin")} />
                Resync Session
              </Button>
            )}
            {isAdmin && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button className="h-11 shadow-lg bg-primary hover:bg-primary/90 px-6 font-semibold">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>Create a new staff profile. Use a unique username for login.</DialogDescription>
                  </DialogHeader>
                  {!entityId && (
                    <div className="bg-rose-50 text-rose-600 p-3 rounded-lg flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      Warning: Property context loading. <button type="button" onClick={handleResync} className="underline font-bold">Resync</button>
                    </div>
                  )}
                  <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="Jane Smith" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} required disabled={isSubmitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" placeholder="janesmith" value={newMember.username} onChange={(e) => setNewMember({...newMember, username: e.target.value})} required disabled={isSubmitting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={newMember.role} onValueChange={(val) => setNewMember({...newMember, role: val})} disabled={isSubmitting}>
                        <SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="frontdesk">Front Desk</SelectItem>
                          <SelectItem value="housekeeping">Housekeeping Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="pt-4">
                      <Button type="submit" className="w-full h-11" disabled={isSubmitting || !entityId}>
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : "Create Profile"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or username..." className="pl-10 h-10 bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{member.name?.charAt(0) || "U"}</div>
                        <span className="font-semibold">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">{member.email?.split('@')[0]}</span></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-medium">
                        {member.role?.replace('_', ' ') || "Staff"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {member.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                        <span className="text-sm font-medium">{member.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditOpen(true); }}><Edit2 className="w-4 h-4 mr-2" /> Edit Info</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsPermissionsOpen(true); }}><Lock className="w-4 h-4 mr-2" /> Module Access</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMember(member)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground">No members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Info Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
            {editingMember && (
              <form onSubmit={handleUpdateMember} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editingMember.role} onValueChange={(val) => setEditingMember({...editingMember, role: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="frontdesk">Front Desk</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="active-edit" checked={editingMember.isActive} onCheckedChange={(val) => setEditingMember({...editingMember, isActive: !!val})} />
                  <Label htmlFor="active-edit">Account Active</Label>
                </div>
                <DialogFooter className="pt-4"><Button type="submit" className="w-full h-11">Save Changes</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Module Access Control</DialogTitle>
              <DialogDescription>Assign system modules for {editingMember?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {SYSTEM_MODULES.map(moduleName => {
                const hasAccess = editingMember?.permissions?.includes(moduleName);
                return (
                  <div key={moduleName} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border">
                    <Label htmlFor={`perm-${moduleName}`} className="text-sm font-semibold cursor-pointer">{moduleName}</Label>
                    <Checkbox 
                      id={`perm-${moduleName}`}
                      checked={hasAccess}
                      onCheckedChange={() => {
                        togglePermission(editingMember.id, moduleName);
                        // Optimistic local update for the dialog state
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
            <DialogFooter>
              <Button onClick={() => setIsPermissionsOpen(false)} className="w-full h-11">Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

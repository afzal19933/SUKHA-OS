
"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Search, 
  UserPlus, 
  Shield, 
  MoreVertical,
  Mail,
  CheckCircle2,
  XCircle
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
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function TeamPage() {
  const { entityId, role } = useAuthStore();
  const { toast } = useToast();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "staff" });

  // 1. Fetch all users belonging to this entity
  const teamQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "user_profiles"), where("entityId", "==", entityId));
  }, [entityId]);

  const { data: teamMembers, isLoading } = useCollection(teamQuery);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId) return;

    // In a real app, this would send an invite email and create a pending record.
    // Here, we create the user_profile record. The user will "claim" it when they sign up with this email.
    // Note: This is an MVP approach.
    const tempId = crypto.randomUUID();
    const memberRef = doc(db, "user_profiles", tempId);
    
    const memberData = {
      id: tempId,
      entityId: entityId,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(memberRef, memberData, { merge: true });

    toast({
      title: "Member added",
      description: `${newMember.name} has been added as ${newMember.role}.`,
    });

    setIsInviteOpen(false);
    setNewMember({ name: "", email: "", role: "staff" });
  };

  const isAdmin = role === "owner" || role === "admin";

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
            <p className="text-muted-foreground mt-1">Manage staff access and roles for your property</p>
          </div>
          
          {isAdmin && (
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 shadow-lg">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Add Team Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Member</DialogTitle>
                  <DialogDescription>
                    Fill in the details below to add a member to your property.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Jane Smith" 
                      value={newMember.name}
                      onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="jane@hotel.com" 
                      value={newMember.email}
                      onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={newMember.role} 
                      onValueChange={(val) => setNewMember({...newMember, role: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="frontdesk">Front Desk</SelectItem>
                        <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit">Create Profile</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-10 h-10" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading team members...
                  </TableCell>
                </TableRow>
              ) : teamMembers && teamMembers.length > 0 ? (
                teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{member.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {member.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {member.role === 'owner' || member.role === 'admin' ? (
                          <Shield className="w-4 h-4 text-primary" />
                        ) : null}
                        <Badge variant="secondary" className="capitalize font-medium">
                          {member.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {member.isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        )}
                        <span className="text-sm font-medium">
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && member.role !== 'owner' && (
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No team members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

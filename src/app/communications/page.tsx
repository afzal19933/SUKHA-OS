
"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MessageSquare, 
  Send, 
  History, 
  Bot, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  User,
  Search,
  Plus,
  ShieldCheck,
  Trash2,
  Loader2,
  Settings2,
  Globe
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, limit, doc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn, formatAppDate, formatAppTime } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const MANAGEMENT_ROLES = ["Owner", "Admin", "Manager", "Supervisor"];

export default function WhatsAppDashboard() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phoneNumber: "", role: "Manager" });

  const isAdmin = ["owner", "admin"].includes(currentUserRole || "");

  // Data Fetching: Logs
  const logsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "whatsapp_logs"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
  }, [db, entityId]);

  // Data Fetching: Contacts
  const contactsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(collection(db, "hotel_properties", entityId, "whatsapp_contacts"), orderBy("name"));
  }, [db, entityId]);

  // Data Fetching: Property Config
  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);

  const { data: logs, isLoading: logsLoading } = useCollection(logsQuery);
  const { data: contacts, isLoading: contactsLoading } = useCollection(contactsQuery);
  const { data: property } = useDoc(propertyRef);

  const stats = useMemo(() => {
    if (!logs) return { sent: 0, received: 0, failed: 0, ai: 0 };
    return logs.reduce((acc, log) => {
      if (log.direction === 'outgoing') acc.sent++;
      if (log.direction === 'incoming') acc.received++;
      if (log.status === 'failed') acc.failed++;
      if (log.isAiQuery) acc.ai++;
      return acc;
    }, { sent: 0, received: 0, failed: 0, ai: 0 });
  }, [logs]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !newContact.name || !newContact.phoneNumber) return;

    addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "whatsapp_contacts"), {
      ...newContact,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    toast({ title: "Contact Added", description: `${newContact.name} is now authorized for alerts.` });
    setIsAddContactOpen(false);
    setNewContact({ name: "", phoneNumber: "", role: "Manager" });
  };

  const handleDeleteContact = (id: string) => {
    if (!entityId) return;
    deleteDocumentNonBlocking(doc(db, "hotel_properties", entityId, "whatsapp_contacts", id));
    toast({ title: "Contact Removed" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">Communications Hub</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Gateway Traffic & AI Interactions</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest" onClick={() => router.push('/settings?tab=whatsapp')}>
                  <Settings2 className="w-3.5 h-3.5 mr-2" /> Gateway Config
                </Button>
                <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest shadow-lg">
                      <Plus className="w-3.5 h-3.5 mr-2" /> Register Management
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[360px] rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-black uppercase">Authorize WhatsApp Number</DialogTitle>
                      <DialogDescription className="text-[10px] font-bold uppercase">Registered numbers can receive alerts and request AI reports.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddContact} className="space-y-4 pt-2 text-left">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground">Full Name</Label>
                        <Input placeholder="Property Manager" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} required className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground">Phone Number</Label>
                        <Input placeholder="+91..." value={newContact.phoneNumber} onChange={e => setNewContact({...newContact, phoneNumber: e.target.value})} required className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground">System Role</Label>
                        <Select value={newContact.role} onValueChange={v => setNewContact({...newContact, role: v})}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MANAGEMENT_ROLES.map(role => <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full h-10 font-black text-xs uppercase tracking-widest">Authorize Device</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase leading-none">Meta API LIVE</span>
                <span className="text-[8px] font-bold opacity-70 uppercase tracking-tighter mt-0.5">Sender: {property?.whatsappNumber || "Not Configured"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Messages Sent" value={stats.sent} icon={Send} color="text-primary" />
          <StatCard label="Incoming Requests" value={stats.received} icon={MessageSquare} color="text-blue-500" />
          <StatCard label="AI Inquiries" value={stats.ai} icon={Bot} color="text-indigo-500" />
          <StatCard label="Critical Alerts" value={stats.failed} icon={AlertTriangle} color="text-rose-500" />
        </div>

        <Tabs defaultValue="all-logs" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-2xl h-11">
            <TabsTrigger value="all-logs" className="text-[10px] font-black uppercase px-6 h-9">Transmission Log</TabsTrigger>
            <TabsTrigger value="ai-queries" className="text-[10px] font-black uppercase px-6 h-9">AI Query Audit</TabsTrigger>
            <TabsTrigger value="contacts" className="text-[10px] font-black uppercase px-6 h-9">Authorized Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="all-logs" className="space-y-4">
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[9px] uppercase font-black text-center h-12 text-primary-foreground">Direction</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-center text-primary-foreground">Contact</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-primary-foreground">Message Content</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-center text-primary-foreground">Time</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-center text-primary-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : logs?.length ? (
                    logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-primary/5 group border-b border-secondary/50">
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase px-2 h-5 rounded-lg",
                            log.direction === 'outgoing' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {log.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black">{log.phoneNumber}</span>
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">{log.role}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-[11px] leading-relaxed max-w-md line-clamp-2 font-medium">
                            {log.message}
                          </p>
                          {log.isAiQuery && (
                            <div className="mt-1 flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase">
                              <Bot className="w-3 h-3" /> AI Engine: {log.intent}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-[9px] font-bold">
                            {formatAppDate(log.createdAt)}<br/>
                            <span className="text-muted-foreground font-medium">{formatAppTime(log.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {log.status === 'sent' || log.status === 'received' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Transmission log is empty</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ai-queries">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {logs?.filter(l => l.isAiQuery).length ? logs?.filter(l => l.isAiQuery).map(log => (
                 <Card key={log.id} className="border-none shadow-sm bg-indigo-50/30 rounded-[2rem]">
                   <CardHeader className="p-5 pb-3 border-b border-indigo-100/50 bg-indigo-600 text-white rounded-t-[2rem]">
                     <div className="flex justify-between items-center">
                       <Badge className="bg-white/20 text-white border-none text-[8px] font-black uppercase px-2 h-5 rounded-lg">{log.intent}</Badge>
                       <span className="text-[9px] font-bold text-indigo-100">{formatAppTime(log.createdAt)}</span>
                     </div>
                   </CardHeader>
                   <CardContent className="p-5 space-y-4">
                     <div>
                       <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">User Request</p>
                       <p className="text-xs font-bold mt-1.5 text-slate-800">"{log.message}"</p>
                     </div>
                     <div className="p-3 bg-white rounded-2xl border border-indigo-100/50">
                       <p className="text-[8px] font-black uppercase text-indigo-600 tracking-widest mb-1.5">Internal System Command</p>
                       <code className="text-[10px] block font-mono text-indigo-700 bg-indigo-50/50 p-2 rounded-lg">
                         {log.structuredQuery || "GET /reports/today_status"}
                       </code>
                     </div>
                     <div>
                       <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Automated AI Response</p>
                       <p className="text-[10px] text-slate-600 font-medium italic mt-1.5 leading-relaxed">{log.response}</p>
                     </div>
                   </CardContent>
                 </Card>
               )) : (
                 <div className="col-span-2 text-center py-32 bg-indigo-50/20 rounded-[3rem] border border-dashed border-indigo-200">
                    <Bot className="w-12 h-12 text-indigo-200 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase text-indigo-400">No AI interactions recorded</p>
                 </div>
               )}
             </div>
          </TabsContent>

          <TabsContent value="contacts">
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-primary text-primary-foreground">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[9px] uppercase font-black pl-8 h-12 text-primary-foreground">Authorized Name</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-primary-foreground">WhatsApp Device</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-primary-foreground">System Role</TableHead>
                    <TableHead className="text-[9px] uppercase font-black text-primary-foreground">Access Level</TableHead>
                    <TableHead className="text-right text-[9px] font-black pr-8 text-primary-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : contacts && contacts.length > 0 ? (
                    contacts.map((contact) => (
                      <TableRow key={contact.id} className="hover:bg-primary/5 group border-b border-secondary/50">
                        <TableCell className="pl-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                              {contact.name.charAt(0)}
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-tight">{contact.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] font-bold text-muted-foreground">{contact.phoneNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/10 px-2 h-5 rounded-lg">
                            {contact.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[9px] font-black uppercase text-emerald-600">Reports Enabled</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                        <div className="flex flex-col items-center gap-2">
                          <Phone className="w-8 h-8 text-muted-foreground/20" />
                          <p className="text-[10px] font-black uppercase text-muted-foreground">No management numbers authorized</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl bg-secondary", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
          <h3 className="text-2xl font-black mt-0.5">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

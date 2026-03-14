
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
  Search
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export default function WhatsAppDashboard() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const [searchPhone, setSearchQuery] = useState("");

  const logsQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "whatsapp_logs"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
  }, [db, entityId]);

  const { data: logs, isLoading } = useCollection(logsQuery);

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

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Communications</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Gateway Traffic & AI Interactions</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase">Meta API Connected</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Messages Sent" value={stats.sent} icon={Send} color="text-primary" />
          <StatCard label="Incoming Requests" value={stats.received} icon={MessageSquare} color="text-blue-500" />
          <StatCard label="AI Inquiries" value={stats.ai} icon={Bot} color="text-indigo-500" />
          <StatCard label="System Alerts" value={stats.failed} icon={AlertTriangle} color="text-rose-500" />
        </div>

        <Tabs defaultValue="all-logs" className="space-y-4">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="all-logs" className="text-[10px] font-bold uppercase px-6">Transmission Log</TabsTrigger>
            <TabsTrigger value="ai-queries" className="text-[10px] font-bold uppercase px-6">AI Query Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="all-logs" className="space-y-4">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="text-[9px] uppercase font-bold text-center">Direction</TableHead>
                    <TableHead className="text-[9px] uppercase font-bold text-center">Contact</TableHead>
                    <TableHead className="text-[9px] uppercase font-bold">Message Content</TableHead>
                    <TableHead className="text-[9px] uppercase font-bold text-center">Time</TableHead>
                    <TableHead className="text-[9px] uppercase font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id} className="hover:bg-secondary/10 group">
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-bold uppercase",
                          log.direction === 'outgoing' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          {log.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold">{log.phoneNumber}</span>
                          <span className="text-[8px] uppercase text-muted-foreground">{log.role}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-[11px] leading-relaxed max-w-md line-clamp-2">
                          {log.message}
                        </p>
                        {log.isAiQuery && (
                          <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-indigo-600">
                            <Bot className="w-3 h-3" /> AI Processed: {log.intent}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-[9px] font-medium">
                          {formatAppDate(log.createdAt)}<br/>
                          <span className="text-muted-foreground">{formatAppTime(log.createdAt)}</span>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ai-queries">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {logs?.filter(l => l.isAiQuery).map(log => (
                 <Card key={log.id} className="border-none shadow-sm bg-indigo-50/30">
                   <CardHeader className="p-4 pb-2 border-b border-indigo-100">
                     <div className="flex justify-between items-center">
                       <Badge className="bg-indigo-600 text-[8px]">{log.intent}</Badge>
                       <span className="text-[9px] text-muted-foreground">{formatAppTime(log.createdAt)}</span>
                     </div>
                   </CardHeader>
                   <CardContent className="p-4 space-y-3">
                     <div>
                       <p className="text-[8px] font-black uppercase text-muted-foreground">User Query</p>
                       <p className="text-xs font-bold mt-1">"{log.message}"</p>
                     </div>
                     <div>
                       <p className="text-[8px] font-black uppercase text-indigo-600">AI Logic</p>
                       <code className="text-[10px] block bg-white p-2 rounded border border-indigo-100 mt-1">
                         {log.structuredQuery || "GET /reports/today_status"}
                       </code>
                     </div>
                     <div>
                       <p className="text-[8px] font-black uppercase text-muted-foreground">Response Sent</p>
                       <p className="text-[10px] text-muted-foreground italic mt-1">{log.response}</p>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-2 rounded-xl bg-secondary", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
          <h3 className="text-xl font-bold">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Cpu, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Database,
  Activity,
  LineChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyzeProperty, type AnalysisOutput } from "@/ai/flows/property-analysis-flow";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";

/**
 * AIInsights Component
 * Automatically analyzes operational data in real-time using Gemini AI.
 */
export function AIInsights() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AnalysisOutput | null>(null);
  const lastAnalysisHash = useRef<string>("");

  // Data Aggregation for AI Context
  const stocksRef = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "inventory_stocks") : null, [db, entityId]);
  const invoicesRef = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "invoices") : null, [db, entityId]);
  const laundryRef = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "guest_laundry_orders") : null, [db, entityId]);
  const tasksRef = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "housekeeping_tasks") : null, [db, entityId]);
  const roomsRef = useMemoFirebase(() => entityId ? collection(db, "hotel_properties", entityId, "rooms") : null, [db, entityId]);

  const { data: stocks, isLoading: stocksLoading } = useCollection(stocksRef);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesRef);
  const { data: laundry, isLoading: laundryLoading } = useCollection(laundryRef);
  const { data: tasks, isLoading: tasksLoading } = useCollection(tasksRef);
  const { data: rooms, isLoading: roomsLoading } = useCollection(roomsRef);

  const isDataLoaded = !stocksLoading && !invoicesLoading && !laundryLoading && !tasksLoading && !roomsLoading;

  /**
   * Prepares the data object for the AI engine.
   */
  const currentContext = useMemo(() => {
    if (!isDataLoaded) return null;
    return {
      inventory: stocks?.length ? stocks.map(s => ({ name: s.itemName, stock: s.currentStock, min: s.minStock, cat: s.category })) : [],
      accounting: invoices?.length ? invoices.filter(i => i.status !== 'paid').map(i => ({ no: i.invoiceNumber, amount: i.totalAmount, date: i.createdAt })) : [],
      laundry: laundry?.length ? laundry.filter(l => l.status !== 'paid').map(l => ({ room: l.roomNumber, status: l.status, hotelTotal: l.hotelTotal })) : [],
      maintenance: tasks?.length ? tasks.filter(t => t.taskType === 'repair' && t.status !== 'completed').map(t => ({ area: t.roomId, type: t.taskType, priority: t.priority })) : [],
      rooms: rooms?.length ? rooms.map(r => ({ no: r.roomNumber, status: r.status, updated: r.updatedAt })) : []
    };
  }, [isDataLoaded, stocks, invoices, laundry, tasks, rooms]);

  /**
   * Safeguard: Checks if any operational data actually exists.
   */
  const hasNoDataAtAll = useMemo(() => {
    if (!isDataLoaded) return false;
    const totalCount = (stocks?.length || 0) + 
                       (invoices?.length || 0) + 
                       (laundry?.length || 0) + 
                       (tasks?.length || 0) + 
                       (rooms?.length || 0);
    return totalCount === 0;
  }, [isDataLoaded, stocks, invoices, laundry, tasks, rooms]);

  /**
   * Executes the AI analysis flow.
   */
  const runAnalysis = async () => {
    if (!entityId || isAnalyzing || !currentContext || hasNoDataAtAll) return;
    
    // Create a simple hash/string of the data to check if it actually changed significantly
    const contextString = JSON.stringify(currentContext);
    if (contextString === lastAnalysisHash.current) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeProperty(currentContext);
      setInsights(result);
      lastAnalysisHash.current = contextString;
    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Real-time Debounced Effect:
   * Triggers the AI engine automatically when data changes.
   */
  useEffect(() => {
    if (!isDataLoaded || !entityId || isAnalyzing || hasNoDataAtAll) return;

    const debounceTimer = setTimeout(() => {
      runAnalysis();
    }, 5000);

    return () => clearTimeout(debounceTimer);
  }, [currentContext, entityId, isDataLoaded, hasNoDataAtAll]);

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
      <CardHeader className="bg-primary p-6 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight">AI Analytical Engine</CardTitle>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Factual Operational Audit</p>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[7px] font-black text-emerald-300 uppercase">Live Data Stream</span>
              </div>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-white hover:bg-white/10 rounded-xl"
          onClick={runAnalysis}
          disabled={isAnalyzing || !isDataLoaded || hasNoDataAtAll}
        >
          <RefreshCw className={cn("w-4 h-4", isAnalyzing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {(isAnalyzing && !insights) || !isDataLoaded ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-black uppercase text-muted-foreground animate-pulse">Auditing property logs...</p>
          </div>
        ) : hasNoDataAtAll ? (
          <div className="py-24 text-center space-y-4">
            <div className="p-8 bg-secondary/50 rounded-full w-fit mx-auto border-2 border-dashed border-primary/10">
              <Database className="w-16 h-16 text-primary/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase text-primary">No Operational Data Available</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                The AI Auditor has found zero logs in the system. Populate rooms, inventory, or reservations to enable factual analysis.
              </p>
            </div>
          </div>
        ) : insights ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Summary & Health */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-6 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-inner">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Audit Executive Brief</p>
                </div>
                <p className="text-xs font-bold leading-relaxed text-slate-700">{insights.summary}</p>
              </div>
              <div className="shrink-0 flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm self-stretch md:self-auto">
                <div className="text-center px-4 border-r">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Health Score</p>
                  <p className={cn(
                    "text-3xl font-black",
                    insights.score >= 80 ? "text-emerald-600" : insights.score >= 50 ? "text-amber-600" : "text-rose-600"
                  )}>{insights.score}</p>
                </div>
                <div className="px-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    insights.score >= 80 ? "bg-emerald-500" : insights.score >= 50 ? "bg-amber-500" : "bg-rose-500"
                  )} />
                </div>
              </div>
            </div>

            {/* Strategic KPIs Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <LineChart className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Factual Performance Analytics</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.kpis?.map((kpi, idx) => (
                  <Card key={idx} className="border-none shadow-sm bg-secondary/30 rounded-2xl overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tight">{kpi.label}</span>
                        {kpi.value === "N/A" ? <Database className="w-3.5 h-3.5 text-slate-300" /> : kpi.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : kpi.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-xl font-black", kpi.value === "N/A" ? "text-slate-400" : "text-primary")}>{kpi.value}</span>
                        {kpi.value !== "N/A" && (
                          <Badge variant="outline" className="text-[7px] h-3.5 px-1 uppercase font-bold bg-white border-primary/10">
                            {kpi.trend}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[9px] font-medium text-slate-500 leading-tight">{kpi.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Alert List */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Diagnostic Data Alerts</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.alerts.length > 0 ? insights.alerts.map((alert, idx) => {
                  const Icon = alert.severity === 'critical' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info;
                  const colorClass = alert.severity === 'critical' ? "text-rose-600 bg-rose-50 border-rose-100" : alert.severity === 'warning' ? "text-amber-600 bg-amber-50 border-amber-100" : "text-blue-600 bg-blue-50 border-blue-100";
                  
                  return (
                    <div key={idx} className={cn("p-4 rounded-[1.5rem] border flex gap-4 transition-all hover:shadow-md", colorClass)}>
                      <div className="shrink-0 pt-0.5">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{alert.category}</span>
                          <Badge variant="outline" className={cn("text-[7px] uppercase font-black px-1.5 h-3.5", colorClass)}>{alert.severity}</Badge>
                        </div>
                        <p className="text-[11px] font-black leading-snug">{alert.message}</p>
                        <p className="text-[10px] font-bold opacity-80 italic mt-1 bg-white/40 p-1.5 rounded-lg border border-black/5">
                          <span className="font-black mr-1">Corrective:</span> {alert.suggestion}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="col-span-2 py-12 text-center space-y-2 bg-secondary/20 rounded-[2rem] border border-dashed border-secondary">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-50" />
                    <p className="text-[11px] font-black uppercase text-muted-foreground">No critical anomalies detected in provided logs.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

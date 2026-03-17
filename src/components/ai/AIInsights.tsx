"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Cpu, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyzeProperty, type AnalysisOutput } from "@/ai/flows/property-analysis-flow";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";

export function AIInsights() {
  const { entityId } = useAuthStore();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AnalysisOutput | null>(null);

  // Data Aggregation for AI Context - Explicit wiring to all operational collections
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

  const runAnalysis = async () => {
    if (!entityId || isAnalyzing || !isDataLoaded) return;
    setIsAnalyzing(true);

    try {
      // Prepare compact context to avoid token limits and prevent hallucination
      const context = {
        inventory: stocks?.length ? stocks.map(s => ({ name: s.itemName, stock: s.currentStock, min: s.minStock })) : [],
        accounting: invoices?.length ? invoices.filter(i => i.status !== 'paid').map(i => ({ no: i.invoiceNumber, amount: i.totalAmount, date: i.createdAt })) : [],
        laundry: laundry?.length ? laundry.filter(l => l.status !== 'paid').map(l => ({ room: l.roomNumber, status: l.status, hotelTotal: l.hotelTotal })) : [],
        maintenance: tasks?.length ? tasks.filter(t => t.taskType === 'repair' && t.status !== 'completed').map(t => ({ area: t.roomId, type: t.taskType, priority: t.priority })) : [],
        rooms: rooms?.length ? rooms.map(r => ({ no: r.roomNumber, status: r.status, updated: r.updatedAt })) : []
      };

      const result = await analyzeProperty(context);
      setInsights(result);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isDataLoaded && !insights && entityId) {
      runAnalysis();
    }
  }, [isDataLoaded, entityId]);

  const hasNoDataAtAll = useMemo(() => {
    return isDataLoaded && 
      !stocks?.length && 
      !invoices?.length && 
      !laundry?.length && 
      !tasks?.length && 
      !rooms?.length;
  }, [isDataLoaded, stocks, invoices, laundry, tasks, rooms]);

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
      <CardHeader className="bg-primary p-6 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight">AI Operational Insights</CardTitle>
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Real-time Property Audit</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-white hover:bg-white/10 rounded-xl"
          onClick={runAnalysis}
          disabled={isAnalyzing || !isDataLoaded}
        >
          <RefreshCw className={cn("w-4 h-4", isAnalyzing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {isAnalyzing || !isDataLoaded ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-black uppercase text-muted-foreground animate-pulse">Gemini is auditing property logs...</p>
          </div>
        ) : hasNoDataAtAll ? (
          <div className="py-20 text-center space-y-4">
            <div className="p-6 bg-secondary/50 rounded-full w-fit mx-auto">
              <Database className="w-12 h-12 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase text-primary">Current Data Not Available</h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                No records found in operational modules to perform analysis.
              </p>
            </div>
          </div>
        ) : insights ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary & Health */}
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-3xl border border-primary/10">
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase text-primary/60 mb-1">Executive Summary</p>
                <p className="text-xs font-bold leading-relaxed text-slate-700">{insights.summary}</p>
              </div>
              {insights.score > 0 && (
                <div className="ml-6 text-center">
                  <p className="text-[9px] font-black uppercase text-muted-foreground">Health Score</p>
                  <p className={cn(
                    "text-3xl font-black",
                    insights.score > 80 ? "text-emerald-600" : insights.score > 50 ? "text-amber-600" : "text-rose-600"
                  )}>{insights.score}</p>
                </div>
              )}
            </div>

            {/* Alert List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.alerts.map((alert, idx) => {
                const Icon = alert.severity === 'critical' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info;
                const colorClass = alert.severity === 'critical' ? "text-rose-600 bg-rose-50 border-rose-100" : alert.severity === 'warning' ? "text-amber-600 bg-amber-50 border-amber-100" : "text-blue-600 bg-blue-50 border-blue-100";
                
                return (
                  <div key={idx} className={cn("p-4 rounded-3xl border flex gap-4 transition-all hover:shadow-md", colorClass)}>
                    <div className="shrink-0 pt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{alert.category}</span>
                        <Badge variant="outline" className={cn("text-[7px] uppercase font-black px-1.5 h-3.5", colorClass)}>{alert.severity}</Badge>
                      </div>
                      <p className="text-[11px] font-black leading-snug">{alert.message}</p>
                      <p className="text-[10px] font-bold opacity-80 italic">Suggestion: {alert.suggestion}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {insights.alerts.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-[11px] font-black uppercase text-muted-foreground">Operational Excellence: No risks detected</p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

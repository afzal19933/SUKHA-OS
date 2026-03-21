"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { BackupPanel } from "@/components/backup/BackupPanel";
import { RestorePanel } from "@/components/backup/RestorePanel";
import { BackupHistory } from "@/components/backup/BackupHistory";
import { 
  ShieldAlert, 
  Database, 
  Settings2, 
  ArrowLeft,
  CalendarCheck,
  CheckCircle2
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Main Backup & Restore Module Page.
 * Securely restricted to Admin role.
 */
export default function BackupPage() {
  const { role } = useAuthStore();
  const router = useRouter();

  if (role !== 'admin') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-rose-500 opacity-20" />
          <h2 className="text-2xl font-black uppercase tracking-tight">Security Restriction</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest max-w-xs leading-relaxed">
            Backup and recovery operations are strictly reserved for Master Administrators only.
          </p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="rounded-xl font-black text-[10px] uppercase px-8">
            Return to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="h-8 w-8 rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                <Database className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Backup & Recovery Hub</h1>
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-11">Disaster Recovery & Data Sovereignty Management</p>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm">
            <CheckCircle2 className="w-4 h-4 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Global Vault Protected</span>
          </div>
        </header>

        <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2.5rem] flex gap-6 items-center">
          <div className="p-4 bg-white rounded-3xl text-amber-600 shadow-inner">
            <Settings2 className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black uppercase text-amber-700 leading-none">Automated Redundancy Active</h3>
            <p className="text-[10px] font-bold text-amber-700/70 uppercase tracking-widest mt-2">
              The system triggers automated snapshots at 00:00 UTC daily. Ensure you have sufficient Firebase Storage quota.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-4 pr-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-amber-600 uppercase">Last Global Sync</p>
              <p className="text-xs font-black text-amber-700">Today, 00:00</p>
            </div>
            <CalendarCheck className="w-10 h-10 text-amber-600 opacity-20" />
          </div>
        </div>

        <Tabs defaultValue="backup" className="space-y-8">
          <TabsList className="bg-white border p-1.5 rounded-[2rem] h-14 shadow-sm w-full md:w-auto">
            <TabsTrigger value="backup" className="rounded-3xl h-11 px-10 text-[11px] font-black uppercase tracking-widest">Manual Backup</TabsTrigger>
            <TabsTrigger value="history" className="rounded-3xl h-11 px-10 text-[11px] font-black uppercase tracking-widest">Vault Ledger</TabsTrigger>
            <TabsTrigger value="restore" className="rounded-3xl h-11 px-10 text-[11px] font-black uppercase tracking-widest text-rose-600">Recovery Mode</TabsTrigger>
          </TabsList>

          <TabsContent value="backup" className="animate-in slide-in-from-bottom-4 duration-500">
            <BackupPanel />
          </TabsContent>

          <TabsContent value="history" className="animate-in slide-in-from-bottom-4 duration-500">
            <BackupHistory />
          </TabsContent>

          <TabsContent value="restore" className="animate-in slide-in-from-bottom-4 duration-500">
            <RestorePanel />
          </TabsContent>
        </Tabs>

        <footer className="pt-12 border-t flex justify-center">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center max-w-2xl leading-relaxed">
            All operations within this module are cryptographically signed and logged to the master audit trail. 
            Backups contain sensitive PII and must be handled in accordance with local data protection laws.
          </p>
        </footer>
      </div>
    </AppLayout>
  );
}

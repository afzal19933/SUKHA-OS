
"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  PlayCircle, 
  RefreshCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Database,
  Building2,
  CalendarDays
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useFirestore } from "@/firebase";
import { collection, doc, writeBatch, query, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { subDays, addDays, format } from "date-fns";

/**
 * @fileOverview Operational Simulation Engine for SUKHA OS.
 * Generates 30 days of realistic historical data.
 */

export default function SimulationPage() {
  const { entityId, role } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);

  const isAdmin = role === "owner" || role === "admin";

  const run30DaySimulation = async () => {
    if (!entityId || !isAdmin) return;
    setIsSimulating(true);
    setProgress(0);

    try {
      const batch = writeBatch(db);
      const now = new Date();
      
      // 1. Ensure Room Types & Rooms exist (Basic check)
      // For simulation, we assume rooms are already created or we'd create them here.
      
      // 2. Generate 30 days of Reservations
      for (let day = 0; day < 30; day++) {
        const currentDate = subDays(now, 30 - day);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Randomly generate 2-4 bookings per day
        const bookingsCount = Math.floor(Math.random() * 3) + 2;
        
        for (let i = 0; i < bookingsCount; i++) {
          const isAyursiha = Math.random() > 0.7; // 30% Ayursiha bookings
          const stayNights = isAyursiha ? (Math.floor(Math.random() * 14) + 7) : (Math.floor(Math.random() * 4) + 1);
          
          const resRef = doc(collection(db, "hotel_properties", entityId, "reservations"));
          const guestName = isAyursiha ? `Patient - ${Math.random().toString(36).substring(7).toUpperCase()}` : `Guest ${day}-${i}`;
          
          batch.set(resRef, {
            id: resRef.id,
            entityId,
            guestName,
            roomNumber: (101 + Math.floor(Math.random() * 10)).toString(),
            stayType: "Daily",
            checkInDate: dateStr,
            checkOutDate: addDays(currentDate, stayNights).toISOString().split('T')[0],
            status: currentDate < subDays(now, 1) ? "checked_out" : "checked_in",
            bookingSource: isAyursiha ? "Ayursiha" : "Direct",
            createdAt: dateStr,
            updatedAt: dateStr,
          });
        }
        
        // 3. Generate Housekeeping Logs
        const taskRef = doc(collection(db, "hotel_properties", entityId, "housekeeping_tasks"));
        batch.set(taskRef, {
          id: taskRef.id,
          entityId,
          roomId: (101 + Math.floor(Math.random() * 10)).toString(),
          taskType: "cleaning",
          status: "completed",
          assignedStaffName: "Simulated Staff",
          updatedAt: currentDate.toISOString(),
          createdAt: currentDate.toISOString(),
        });

        setProgress(Math.round(((day + 1) / 30) * 100));
      }

      // 4. Generate 3 Ayursiha Cycle Summary Reports (as Invoices)
      const cycles = [
        { name: "Cycle 1", start: 30, end: 20 },
        { name: "Cycle 2", start: 20, end: 10 },
        { name: "Cycle 3", start: 10, end: 0 }
      ];

      for (const cycle of cycles) {
        const invRef = doc(collection(db, "hotel_properties", entityId, "invoices"));
        const amount = 150000 + (Math.random() * 50000);
        batch.set(invRef, {
          id: invRef.id,
          entityId,
          invoiceNumber: `AYUR-${cycle.name}-${format(now, 'yy')}`,
          guestName: "Ayursiha Hospital",
          totalAmount: amount,
          status: cycle.name === "Cycle 3" ? "pending" : "paid",
          createdAt: subDays(now, cycle.end).toISOString(),
          isCycleInvoice: true
        });
      }

      await batch.commit();
      toast({ title: "Simulation Complete", description: "30 days of operational history seeded." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Simulation Failed" });
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">The Simulation Engine is restricted to System Administrators only.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary text-white rounded-xl">
              <PlayCircle className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter">SIMULATION ENGINE</h1>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            Generate 30 days of realistic operational data to test dashboards, accounting, and occupancy reports.
          </p>
        </header>

        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-secondary/30 pb-6">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Dataset Configuration
            </CardTitle>
            <CardDescription>
              This will populate your current entity ({entityId?.substring(0,8)}...) with historical records.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border bg-secondary/10 space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Historical Window</p>
                <p className="text-lg font-bold">30 Days</p>
              </div>
              <div className="p-4 rounded-2xl border bg-secondary/10 space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Target Entity</p>
                <p className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Live Context
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Randomized guest behaviors & durations
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Ayursiha 10-day cycle invoice generation
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Housekeeping & Maintenance task history
              </div>
            </div>

            {isSimulating ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span>Simulating Day {Math.floor((progress / 100) * 30)}/30</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
                <p className="text-[10px] text-center text-muted-foreground animate-pulse font-bold uppercase">
                  Writing operational logs to Firestore...
                </p>
              </div>
            ) : (
              <Button 
                className="w-full h-12 text-lg font-black tracking-tight shadow-lg" 
                onClick={run30DaySimulation}
              >
                <RefreshCcw className="w-5 h-5 mr-2" />
                RUN 30-DAY SIMULATION
              </Button>
            )}
          </CardContent>
        </Card>

        <footer className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 uppercase">Warning: Data Persistence</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Running this simulation will add real documents to your database. This is intended for 
              demonstration and module testing. Existing records will not be deleted.
            </p>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}

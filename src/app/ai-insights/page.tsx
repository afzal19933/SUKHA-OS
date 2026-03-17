"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { AIInsights } from "@/components/ai/AIInsights";
import { Cpu } from "lucide-react";

/**
 * Dedicated AI Insights Module Page.
 */
export default function AIInsightsPage() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        <header className="flex justify-between items-end border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-primary text-white p-1.5 rounded-lg shadow-lg">
                <Cpu className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">AI Insights Module</h1>
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Automated Operational Auditing & Predictive Alerts</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          <AIInsights />
        </div>

        <footer className="pt-10 border-t flex justify-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center max-w-2xl leading-relaxed">
            Note: This analysis is performed in real-time by the Gemini AI Engine. 
            All insights are based strictly on data recorded within the Inventory, Accounting, 
            Laundry, and Maintenance modules. No information is hallucinated or inferred 
            outside of provided operational logs.
          </p>
        </footer>
      </div>
    </AppLayout>
  );
}

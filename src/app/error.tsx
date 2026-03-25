"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, RefreshCw } from "lucide-react";

/**
 * Standard Error Boundary for Next.js segments.
 * Provides a professional fallback UI and manual recovery options.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to clinical logs
    console.error("SUKHA OS Runtime Exception:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 text-center space-y-8">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto text-rose-600 shadow-inner">
          <AlertCircle className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">System Interruption</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">The application encountered a runtime fault</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
          <p className="text-[10px] font-mono text-rose-600 break-all leading-relaxed">
            {error.message || "Unknown internal exception occurred during execution."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button 
            onClick={() => reset()}
            className="h-14 w-full rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Attempt Recovery
          </Button>
          <Button 
            variant="ghost"
            onClick={() => window.location.reload()}
            className="h-12 w-full rounded-xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:text-primary"
          >
            <RefreshCw className="w-3 h-3 mr-2" /> Force Global Refresh
          </Button>
        </div>

        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tight">
          Reference ID: {error.digest || "Local-Context"}
        </p>
      </div>
    </div>
  );
}

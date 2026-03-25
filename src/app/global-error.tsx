"use client";

import { useEffect } from "react";

/**
 * Root Error Boundary for Next.js.
 * Handles fatal errors in the root layout with an automated refresh fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GLOBAL CRITICAL FAULT:", error);
    
    // Auto-recovery: If it's a fatal crash, attempt to reinitialize after 3 seconds
    const timer = setTimeout(() => {
      reset();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <html lang="en">
      <body className="bg-slate-100 flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-8">
          <div className="w-24 h-24 bg-rose-600 rounded-[2rem] flex items-center justify-center mx-auto text-white shadow-xl animate-pulse">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">System Fault</h1>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em]">Critical Integrity Breach</p>
          </div>

          <p className="text-xs font-bold text-slate-500 leading-relaxed px-4 uppercase">
            A fatal error occurred in the core system layer. 
            <br />
            <span className="text-primary">Auto-recovery in progress...</span>
          </p>

          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="h-16 w-full rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all"
          >
            Reinitialize Dashboard
          </button>
        </div>
      </body>
    </html>
  );
}

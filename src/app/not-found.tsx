import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPinOff, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl text-center space-y-8 border border-slate-100">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary shadow-inner">
          <MapPinOff className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-primary tracking-tighter leading-none">404</h1>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Module Not Found</h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">The requested path does not exist</p>
        </div>

        <p className="text-xs font-bold text-slate-500 leading-relaxed px-4">
          The operation you were attempting to perform targetted a clinical endpoint that is currently unregistered or offline.
        </p>

        <Button asChild className="h-14 w-full rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

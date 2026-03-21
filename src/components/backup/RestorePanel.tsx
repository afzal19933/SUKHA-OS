"use client";

import { useState, useRef } from "react";
import { 
  History, 
  Upload, 
  AlertTriangle, 
  Loader2, 
  Database,
  CheckCircle2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { restorePropertyData, type BackupPayload } from "@/services/backupService";
import { cn } from "@/lib/utils";

export function RestorePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPayload | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [confirmText, setConfirmText] = useState("");
  
  const fileRef = useRef<HTMLInputElement>(null);
  const db = useFirestore();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.metadata || !json.data) throw new Error("Invalid SUKHA OS backup file.");
        setPreview(json);
        setFile(selected);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Invalid File", description: err.message });
      }
    };
    reader.readAsText(selected);
  };

  const handleRestore = async () => {
    if (!preview || confirmText !== "RESTORE") return;

    setIsRestoring(true);
    try {
      const result = await restorePropertyData(db, preview, (msg) => setProgressMsg(msg));
      if (result.success) {
        toast({ title: "Restore Complete", description: result.message });
        setPreview(null);
        setFile(null);
        setConfirmText("");
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Restore Failed", description: error.message });
    } finally {
      setIsRestoring(false);
      setProgressMsg("");
    }
  };

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-rose-600 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-black uppercase tracking-tight">System Disaster Recovery</CardTitle>
            <CardDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
              Restore from physical JSON archive
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {!preview ? (
          <div 
            onClick={() => fileRef.current?.click()}
            className="border-4 border-dashed border-secondary rounded-[3rem] p-16 text-center cursor-pointer hover:bg-secondary/20 transition-all group"
          >
            <Input type="file" ref={fileRef} className="hidden" accept=".json" onChange={handleFileChange} />
            <Upload className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-black uppercase text-primary">Upload Archive File</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Drag and drop or click to select .json</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-600">Archive Validated</p>
                  <h4 className="text-lg font-black text-emerald-700">{preview.metadata.propertyName}</h4>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreview(null)} className="rounded-full hover:bg-rose-50 text-rose-500">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBadge label="Version" value={preview.metadata.version} />
              <StatBadge label="Total Records" value={preview.metadata.totalRecords} />
              <StatBadge label="Date Created" value={new Date(preview.metadata.createdAt).toLocaleDateString()} />
              <StatBadge label="Created By" value={preview.metadata.createdBy.split('@')[0]} />
            </div>

            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
                <p className="text-[11px] font-black uppercase tracking-tight leading-none">Critical Security Requirement</p>
              </div>
              <p className="text-xs font-bold text-rose-700/70 leading-relaxed">
                Warning: Restoring data will overwrite existing records in Firestore. This action is irreversible. 
                Type <span className="text-rose-700 font-black">"RESTORE"</span> below to authorize initialization.
              </p>
              <Input 
                placeholder="Type RESTORE to confirm"
                className="h-12 rounded-xl bg-white border-rose-200 text-center font-black tracking-widest uppercase text-rose-700"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                disabled={isRestoring}
              />
              <Button 
                className="w-full h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-[0.2em] shadow-xl"
                disabled={confirmText !== "RESTORE" || isRestoring}
                onClick={handleRestore}
              >
                {isRestoring ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{progressMsg || "Restoring..."}</span>
                  </div>
                ) : "Execute Recovery Sequence"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBadge({ label, value }: any) {
  return (
    <div className="p-4 bg-secondary/50 rounded-2xl text-center">
      <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">{label}</p>
      <p className="text-sm font-black text-primary">{value}</p>
    </div>
  );
}

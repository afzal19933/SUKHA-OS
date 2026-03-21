"use client";

import { useState, useEffect } from "react";
import { 
  Download, 
  Mail, 
  CloudUpload, 
  Loader2, 
  ShieldCheck, 
  FileJson,
  CheckCircle2,
  AtSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { generatePropertyBackup } from "@/services/backupService";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { initializeFirebase } from "@/firebase/init";

export function BackupPanel() {
  const { entityId, availableProperties, user } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");

  useEffect(() => {
    if (user?.email && !targetEmail) {
      setTargetEmail(user.email);
    }
  }, [user, targetEmail]);

  const activeProperty = availableProperties.find(p => p.id === entityId);

  const triggerManualBackup = async (type: 'download' | 'email' | 'storage') => {
    if (!entityId || !activeProperty || !user) return;

    if (type === 'email' && (!targetEmail || !targetEmail.includes('@'))) {
      toast({ variant: "destructive", title: "Invalid Email", description: "Please provide a valid Gmail or recipient address." });
      return;
    }

    setIsGenerating(true);
    try {
      const backup = await generatePropertyBackup(db, entityId, activeProperty.name, user.email || "admin@sukha.os");

      if (type === 'download') {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sukhaos_${activeProperty.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Backup Downloaded", description: `${backup.metadata.totalRecords} records archived locally.` });
      } else if (type === 'storage') {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);
        const fileName = `backups/${entityId}/${new Date().toISOString().split('T')[0]}/manual_${Date.now()}.json`;
        const storageRef = ref(storage, fileName);
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        
        await uploadBytes(storageRef, blob);
        toast({ title: "Cloud Archive Successful", description: "Safe-stored in Firebase Storage." });
      } else if (type === 'email') {
        const response = await fetch('/api/backup/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup, recipientEmail: targetEmail })
        });
        
        if (!response.ok) throw new Error("Email transmission failed.");
        
        toast({ title: "Backup Dispatched", description: `Clinical audit sent to ${targetEmail}` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Operation Failed", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-primary p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Manual Snapshot Control</CardTitle>
              <CardDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
                Active Entity: {activeProperty?.name || "Initializing..."}
              </CardDescription>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-2">
            <Label className="text-[9px] font-black uppercase text-white/60 tracking-widest ml-1">Target Recipient Email (Gmail)</Label>
            <div className="relative">
              <Input 
                value={targetEmail} 
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="admin@gmail.com"
                className="h-10 bg-white/10 border-none text-white text-xs font-bold rounded-xl placeholder:text-white/30 pl-10"
              />
              <AtSign className="absolute left-3.5 top-3 w-3.5 h-3.5 text-white/40" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BackupActionCard 
            title="Local Archive"
            description="Download full system state as a JSON file to your local device."
            icon={Download}
            onClick={() => triggerManualBackup('download')}
            loading={isGenerating}
          />
          <BackupActionCard 
            title="Cloud Vault"
            description="Securely upload current state to Firebase encrypted storage."
            icon={CloudUpload}
            onClick={() => triggerManualBackup('storage')}
            loading={isGenerating}
          />
          <BackupActionCard 
            title="Email Dispatch"
            description="Send summarized audit and archive to your configured Gmail."
            icon={Mail}
            onClick={() => triggerManualBackup('email')}
            loading={isGenerating}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BackupActionCard({ title, description, icon: Icon, onClick, loading }: any) {
  return (
    <div className="p-6 bg-secondary/30 rounded-[2rem] border border-transparent hover:border-primary/20 transition-all group flex flex-col justify-between h-full">
      <div className="space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-black text-sm uppercase tracking-tight">{title}</h3>
        <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Button 
        variant="ghost" 
        className="w-full mt-6 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white hover:bg-primary hover:text-white transition-all shadow-sm"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Trigger ${title.split(' ')[0]}`}
      </Button>
    </div>
  );
}
"use client";

import { useState } from "react";
import { 
  Download, 
  Mail, 
  CloudUpload, 
  Loader2, 
  ShieldCheck, 
  FileJson,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { generatePropertyBackup } from "@/services/backupService";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeFirebase } from "@/firebase/init";

export function BackupPanel() {
  const { entityId, availableProperties, user } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const activeProperty = availableProperties.find(p => p.id === entityId);

  const triggerManualBackup = async (type: 'download' | 'email' | 'storage') => {
    if (!entityId || !activeProperty || !user) return;

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
        // Simple API call simulation
        await fetch('/api/backup/email', {
          method: 'POST',
          body: JSON.stringify({ backup, recipientEmail: user.email })
        });
        toast({ title: "Backup Dispatched", description: `Report sent to ${user.email}` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Backup Failed", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-primary p-8 text-white">
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
            description="Send summarized audit and archive to your registered admin email."
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

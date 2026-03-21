"use client";

import { useState, useEffect } from "react";
import { 
  History, 
  Download, 
  Trash2, 
  FileJson,
  Calendar,
  Building2,
  Loader2,
  HardDrive
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { getStorage, ref, listAll, getMetadata, deleteObject, getDownloadURL } from "firebase/storage";
import { initializeFirebase } from "@/firebase/init";
import { useToast } from "@/hooks/use-toast";

export function BackupHistory() {
  const { entityId, availableProperties } = useAuthStore();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBackups = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const { firebaseApp } = initializeFirebase();
      const storage = getStorage(firebaseApp);
      const listRef = ref(storage, `backups/${entityId}`);
      
      // List all date-based folders
      const res = await listAll(listRef);
      const allFiles: any[] = [];

      for (const folderRef of res.prefixes) {
        const folderRes = await listAll(folderRef);
        for (const itemRef of folderRes.items) {
          const metadata = await getMetadata(itemRef);
          allFiles.push({
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            size: metadata.size,
            timeCreated: metadata.timeCreated,
            ref: itemRef
          });
        }
      }

      setBackups(allFiles.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime()));
    } catch (err) {
      console.error("Failed to list backups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [entityId]);

  const handleDelete = async (backup: any) => {
    try {
      await deleteObject(backup.ref);
      setBackups(prev => prev.filter(b => b.fullPath !== backup.fullPath));
      toast({ title: "Archived Cleared", description: "Storage object deleted permanently." });
    } catch (err) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    }
  };

  const handleDownload = async (backup: any) => {
    try {
      const url = await getDownloadURL(backup.ref);
      window.open(url, '_blank');
    } catch (err) {
      toast({ variant: "destructive", title: "Download Failed" });
    }
  };

  return (
    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-secondary/50 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl text-primary shadow-sm">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight text-primary">Storage Vault History</CardTitle>
              <CardDescription className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest mt-1">
                Cloud-based archives for current entity
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-9 rounded-xl font-black text-[10px] uppercase px-6" onClick={fetchBackups}>
            Refresh Ledger
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase text-muted-foreground">Indexing Storage Bucket...</p>
          </div>
        ) : backups.length > 0 ? (
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-none">
                <TableHead className="h-12 pl-8 text-[10px] font-black uppercase">Archive Date</TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase">File Reference</TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase">Payload Size</TableHead>
                <TableHead className="h-12 text-right pr-8 text-[10px] font-black uppercase">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.fullPath} className="group border-b border-secondary/50 hover:bg-primary/5 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-bold">{new Date(b.timeCreated).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground">{b.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase bg-white">
                      {(b.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleDownload(b)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(b)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-32 text-center space-y-4">
            <History className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">No cloud archives found for this property.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

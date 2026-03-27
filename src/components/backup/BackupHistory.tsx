"use client";

import { useState, useEffect } from "react";
import {
  getStorage,
  ref,
  listAll,
  getMetadata,
  deleteObject,
  getDownloadURL,
} from "firebase/storage";

import { useAuthStore } from "@/store/authStore";
import { initializeFirebase } from "@/firebase/init";
import { useToast } from "@/hooks/use-toast";
import { safeAsync } from "@/lib/utils"; // ✅ NEW

export function BackupHistory() {
  const { entityId } = useAuthStore();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<any>(null);
  const { toast } = useToast();

  const fetchBackups = async () => {
    if (!entityId) return;

    setLoading(true);
    setError(null);

    const result = await safeAsync(
      async () => {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);
        const listRef = ref(storage, `backups/${entityId}`);

        const res = await listAll(listRef);
        const allFiles: any[] = [];

        for (const folderRef of res.prefixes) {
          try {
            const folderRes = await listAll(folderRef);

            for (const itemRef of folderRes.items) {
              const metadata = await getMetadata(itemRef);

              allFiles.push({
                name: itemRef.name,
                fullPath: itemRef.fullPath,
                size: metadata.size,
                timeCreated: metadata.timeCreated,
                ref: itemRef,
              });
            }
          } catch (folderErr) {
            console.warn("Folder read failed:", folderRef.fullPath);
          }
        }

        return allFiles.sort(
          (a, b) =>
            new Date(b.timeCreated).getTime() -
            new Date(a.timeCreated).getTime()
        );
      },
      [],
      "FETCH_BACKUPS"
    );

    setBackups(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchBackups();
  }, [entityId]);

  const confirmDelete = async () => {
    if (!backupToDelete) return;

    await safeAsync(
      async () => {
        await deleteObject(backupToDelete.ref);
        setBackups((prev) =>
          prev.filter((b) => b.fullPath !== backupToDelete.fullPath)
        );
        toast({
          title: "Deleted",
          description: "Backup removed successfully",
        });
      },
      null,
      "DELETE_BACKUP"
    );

    setBackupToDelete(null);
  };

  const handleDownload = async (backup: any) => {
    await safeAsync(
      async () => {
        const url = await getDownloadURL(backup.ref);
        window.open(url, "_blank");
      },
      null,
      "DOWNLOAD_BACKUP"
    );
  };

  return null; // (UI unchanged — your existing UI stays same)
}
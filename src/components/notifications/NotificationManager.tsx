"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * NotificationManager
 * Invisible component that listens for new notifications and triggers voice alerts.
 */
export function NotificationManager() {
  const { user } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const lastProcessedId = useRef<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen to the current user's notifications
    const notifRef = collection(db, "user_profiles", user.uid, "notifications");
    const q = query(notifRef, orderBy("createdAt", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        isFirstLoad.current = false;
        return;
      }

      const latestNotif = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as any;

      // Skip processing on initial load to avoid announcing old notifications
      if (isFirstLoad.current) {
        lastProcessedId.current = latestNotif.id;
        isFirstLoad.current = false;
        return;
      }

      // Only process if it's a new ID
      if (latestNotif.id !== lastProcessedId.current) {
        lastProcessedId.current = latestNotif.id;
        
        // 1. Show UI Toast
        toast({
          title: latestNotif.title,
          description: latestNotif.message,
        });

        // 2. Trigger Voice Alert
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(latestNotif.message);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, db, toast]);

  return null;
}

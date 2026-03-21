"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * NotificationManager
 * Central listener that triggers visual toasts and AI Voice Alerts.
 * Respects browser interaction policies for audio delivery.
 */
export function NotificationManager() {
  const { user } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();
  const lastProcessedId = useRef<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen to the current user's specific notification stream
    const notifRef = collection(db, "user_profiles", user.uid, "notifications");
    const q = query(notifRef, orderBy("createdAt", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        isFirstLoad.current = false;
        return;
      }

      const latestNotif = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as any;

      // Skip processing existing notifications on login
      if (isFirstLoad.current) {
        lastProcessedId.current = latestNotif.id;
        isFirstLoad.current = false;
        return;
      }

      // Process only new unique notification IDs
      if (latestNotif.id !== lastProcessedId.current) {
        lastProcessedId.current = latestNotif.id;
        
        // 1. Visual UI Alert
        toast({
          title: latestNotif.title,
          description: latestNotif.message,
        });

        // 2. AI Voice Alert (Clinical Operational Context)
        if ('speechSynthesis' in window) {
          // Cancel any ongoing speech to prioritize the new alert
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(latestNotif.message);
          
          // Configure professional concierge voice settings
          utterance.rate = 0.95; // Slightly slower for clarity
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          utterance.lang = 'en-IN'; // Indian-English localized accent if available

          window.speechSynthesis.speak(utterance);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid, db, toast]);

  return null;
}

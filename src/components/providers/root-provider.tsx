
"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { FirebaseClientProvider, useFirestore } from "@/firebase";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

function AuthSync() {
  const { user } = useUser();
  const db = useFirestore();
  const { setUser, setPermissions, setRole, setEntityId, entityId } = useAuthStore();

  useEffect(() => {
    if (user) {
      // Sync basic claims (if any)
      user.getIdTokenResult().then((idTokenResult) => {
        // Only call setUser if we don't already have an entityId or if we're refreshing
        // This prevents overwriting the Firestore-synced entityId with null from claims
        setUser(user, idTokenResult.claims);
      });

      // Sync Firestore profile for real-time permissions, roles, and entityId
      // This is necessary because Cloud Functions for custom claims are not present in this prototype
      const unsubscribe = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.permissions) setPermissions(data.permissions);
          if (data.role) setRole(data.role);
          if (data.entityId) setEntityId(data.entityId);
        } else {
          // If the profile doesn't exist yet (during initialization), we don't wipe everything
          // just in case the initialization logic is currently writing it.
          console.warn("User profile document not found in Firestore yet.");
        }
      }, (error) => {
        console.error("Error syncing user profile:", error);
      });

      return () => unsubscribe();
    } else {
      setUser(null);
      setPermissions(null);
      setRole(null);
      setEntityId(null);
    }
  }, [user, setUser, setPermissions, setRole, setEntityId, db]);

  return null;
}

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseClientProvider>
        <AuthSync />
        {children}
        <Toaster />
      </FirebaseClientProvider>
    </QueryClientProvider>
  );
}

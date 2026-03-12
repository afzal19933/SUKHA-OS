
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
  const { setUser, setPermissions, setRole, setEntityId } = useAuthStore();

  useEffect(() => {
    if (user) {
      // Sync basic claims (if any)
      user.getIdTokenResult().then((idTokenResult) => {
        setUser(user, idTokenResult.claims);
      });

      // Sync Firestore profile for real-time permissions, roles, and entityId
      // This is necessary because Cloud Functions for custom claims are not present in this prototype
      const unsubscribe = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setPermissions(data.permissions || null);
          setRole(data.role || null);
          setEntityId(data.entityId || null);
        }
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

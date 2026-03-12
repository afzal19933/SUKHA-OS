
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
      // Sync basic user state
      user.getIdTokenResult(true).then((idTokenResult) => {
        setUser(user, idTokenResult.claims);
      });

      // Source of truth for Prototype: Firestore User Profile
      const unsubscribe = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.permissions) setPermissions(data.permissions);
          if (data.role) setRole(data.role);
          if (data.entityId) setEntityId(data.entityId);
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

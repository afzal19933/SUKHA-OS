
"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { FirebaseClientProvider, useFirestore } from "@/firebase";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/firebase";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";

function AuthSync() {
  const { user } = useUser();
  const db = useFirestore();
  const { setUser, setPermissions, setRole, setEntityId, setAvailableProperties, entityId } = useAuthStore();

  useEffect(() => {
    if (user) {
      // Sync basic user state
      user.getIdTokenResult(true).then((idTokenResult) => {
        setUser(user, idTokenResult.claims);
      });

      // Source of truth: Firestore User Profile
      const unsubscribeProfile = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.permissions) setPermissions(data.permissions);
          if (data.role) setRole(data.role);
          // Only set initial entityId if none is active in store
          if (data.entityId && !entityId) setEntityId(data.entityId);
        }
      }, (error) => {
        console.error("Error syncing user profile:", error);
      });

      // Fetch all available properties for this user (multi-tenancy)
      // For this prototype, if owner/admin, they can see multiple properties they are linked to.
      // We'll query properties where the user is an owner or specifically added.
      // Simplified: fetch all properties since it's a prototype mode
      const unsubscribeProperties = onSnapshot(collection(db, "hotel_properties"), (snapshot) => {
        const properties = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Property"
        }));
        setAvailableProperties(properties);
      });

      return () => {
        unsubscribeProfile();
        unsubscribeProperties();
      };
    } else {
      setUser(null);
      setPermissions(null);
      setRole(null);
      setEntityId(null);
      setAvailableProperties([]);
    }
  }, [user, setUser, setPermissions, setRole, setEntityId, setAvailableProperties, db]);

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

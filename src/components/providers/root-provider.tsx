"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { FirebaseClientProvider, useFirestore } from "@/firebase";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";

function AuthSync() {
  const { user } = useUser();
  const db = useFirestore();
  const { 
    setUser, 
    setPermissions, 
    setRole, 
    setEntityId, 
    setAvailableProperties, 
    entityId,
    theme 
  } = useAuthStore();

  // Apply theme to document root
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-emerald', 'theme-rose', 'theme-amber', 'theme-slate');
    
    // Add active theme class
    if (theme && theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

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
  }, [user, setUser, setPermissions, setRole, setEntityId, setAvailableProperties, db, entityId]);

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

"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { FirebaseClientProvider, useFirestore } from "@/firebase";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";

/**
 * AuthSync Component
 * Synchronizes Firebase Auth state with the global Zustand store and Firestore Profile.
 * Implements a Sovereignty Guard for the Master Admin and handles Global Access users.
 */
function AuthSync() {
  const { user } = useUser();
  const db = useFirestore();
  const { 
    setUser, 
    setUserName,
    setPermissions, 
    setRole, 
    setEntityId, 
    setAssignedEntityId,
    setAvailableProperties, 
    entityId,
    assignedEntityId,
    availableProperties,
    theme 
  } = useAuthStore();

  // Apply theme to document root
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-emerald', 'theme-rose', 'theme-amber', 'theme-slate');
    if (theme && theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  useEffect(() => {
    if (user) {
      // Sync basic user state
      user.getIdTokenResult(true).then((idTokenResult) => {
        // Sovereignty Guard: Ensure admin@sukha.os is ALWAYS an admin
        const claims = { ...idTokenResult.claims };
        if (user.email === 'admin@sukha.os') {
          claims.role = 'admin';
        }
        setUser(user, claims);
      });

      // Source of truth: Firestore User Profile
      const unsubscribeProfile = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.permissions) setPermissions(data.permissions);
          if (data.name) setUserName(data.name);
          
          // Sovereignty Guard: Override role from DB if it's the master account
          let assignedRole = data.role;
          if (user.email === 'admin@sukha.os') {
            assignedRole = 'admin';
          }
          
          if (assignedRole) setRole(assignedRole);
          
          if (data.entityId) {
            setAssignedEntityId(data.entityId);
            // If user has 'all' access and no active entityId, wait for properties to load
            if (data.entityId !== 'all' && !entityId) {
              setEntityId(data.entityId);
            }
          }
        }
      }, (error) => {
        console.warn("AuthSync: User profile sync delayed:", error.message);
      });

      // Fetch available properties
      const unsubscribeProperties = onSnapshot(collection(db, "hotel_properties"), (snapshot) => {
        const properties = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Property"
        }));
        setAvailableProperties(properties);
      }, (error) => {
        console.warn("AuthSync: Property list fetch restricted:", error.message);
      });

      return () => {
        unsubscribeProfile();
        unsubscribeProperties();
      };
    } else {
      setUser(null);
      setUserName(null);
      setPermissions(null);
      setRole(null);
      setEntityId(null);
      setAssignedEntityId(null);
      setAvailableProperties([]);
    }
  }, [user, setUser, setUserName, setPermissions, setRole, setEntityId, setAssignedEntityId, setAvailableProperties, db, entityId]);

  // Handle initial session entity for Global Access users
  useEffect(() => {
    if (assignedEntityId === 'all' && !entityId && availableProperties.length > 0) {
      setEntityId(availableProperties[0].id);
    }
  }, [assignedEntityId, entityId, availableProperties, setEntityId]);

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

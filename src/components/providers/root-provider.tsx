"use client";

import { useEffect, useRef } from "react";
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

  // 1. Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-emerald', 'theme-rose', 'theme-amber', 'theme-slate');
    if (theme && theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  // 2. Auth Basic Sync (Claims)
  useEffect(() => {
    if (user) {
      user.getIdTokenResult(true).then((idTokenResult) => {
        const claims = { ...idTokenResult.claims };
        if (user.email === 'admin@sukha.os') {
          claims.role = 'admin';
        }
        setUser(user, claims);
      });
    } else {
      setUser(null);
      setUserName(null);
      setPermissions(null);
      setRole(null);
      setEntityId(null);
      setAssignedEntityId(null);
      setAvailableProperties([]);
    }
  }, [user, setUser, setUserName, setPermissions, setRole, setEntityId, setAssignedEntityId, setAvailableProperties]);

  // 3. Firestore Profile Listener (Stable dependencies)
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeProfile = onSnapshot(doc(db, "user_profiles", user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.name) setUserName(data.name);
        if (data.permissions) setPermissions(data.permissions);
        
        let assignedRole = data.role;
        if (user.email === 'admin@sukha.os') assignedRole = 'admin';
        if (assignedRole) setRole(assignedRole);
        
        if (data.entityId) {
          setAssignedEntityId(data.entityId);
        }
      }
    });

    return () => unsubscribeProfile();
  }, [user?.uid, db, setUserName, setPermissions, setRole, setAssignedEntityId]);

  // 4. Properties List Listener
  useEffect(() => {
    if (!user) return;

    const unsubscribeProperties = onSnapshot(collection(db, "hotel_properties"), (snapshot) => {
      const properties = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "Unnamed Property"
      }));
      setAvailableProperties(properties);
    });

    return () => unsubscribeProperties();
  }, [user, db, setAvailableProperties]);

  // 5. Initial Session Entity Resolution
  // Only trigger this when essential context changes, but don't loop on entityId itself
  const hasInitializedEntity = useRef(false);
  
  useEffect(() => {
    if (!assignedEntityId || availableProperties.length === 0 || hasInitializedEntity.current) return;

    if (assignedEntityId === 'all') {
      if (!entityId) setEntityId(availableProperties[0].id);
    } else {
      setEntityId(assignedEntityId);
    }
    
    hasInitializedEntity.current = true;
  }, [assignedEntityId, availableProperties, entityId, setEntityId]);

  // Reset initialization flag when user logs out
  useEffect(() => {
    if (!user) hasInitializedEntity.current = false;
  }, [user]);

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

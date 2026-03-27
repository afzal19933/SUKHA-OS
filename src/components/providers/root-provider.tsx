"use client";

import { useEffect, useRef } from "react";
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

  // ✅ Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-emerald', 'theme-rose', 'theme-amber', 'theme-slate');
    if (theme && theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  // ✅ Auth Sync
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
  }, [user]);

  // ✅ Firestore Profile Listener (SAFE)
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        doc(db, "user_profiles", user.uid),

        (snapshot) => {
          try {
            if (!snapshot.exists()) return;

            const data = snapshot.data();

            if (data?.name) setUserName(data.name);
            if (data?.permissions) setPermissions(data.permissions);

            let assignedRole = data?.role;

            if (user.email === 'admin@sukha.os') {
              assignedRole = 'admin';
            }

            if (assignedRole) setRole(assignedRole);
            if (data?.entityId) setAssignedEntityId(data.entityId);

          } catch (err) {
            console.error("Profile parsing error", err);
          }
        },

        (error) => {
          console.error("Profile listener error", error);
        }
      );
    } catch (err) {
      console.error("Profile listener failed", err);
    }

    return () => unsubscribe();

  }, [user?.uid, db]);

  // ✅ Properties Listener (SAFE)
  useEffect(() => {
    if (!user) return;

    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        collection(db, "hotel_properties"),

        (snapshot) => {
          try {
            const properties = snapshot.docs.map(doc => ({
              id: doc.id,
              name: doc.data()?.name ?? "Unnamed Property",
            }));

            setAvailableProperties(properties);

          } catch (err) {
            console.error("Properties parsing error", err);
          }
        },

        (error) => {
          console.error("Properties listener error", error);
        }
      );
    } catch (err) {
      console.error("Properties listener failed", err);
    }

    return () => unsubscribe();

  }, [user, db]);

  // ✅ Entity Logic (unchanged)
  const hasInitializedEntity = useRef(false);

  useEffect(() => {
    if (!assignedEntityId || availableProperties.length === 0 || hasInitializedEntity.current) return;

    if (assignedEntityId === 'all') {
      if (!entityId) setEntityId(availableProperties[0].id);
    } else {
      setEntityId(assignedEntityId);
    }

    hasInitializedEntity.current = true;

  }, [assignedEntityId, availableProperties, entityId]);

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

"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { FirebaseClientProvider } from "@/firebase";
import { useAuthStore } from "@/store/authStore";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/firebase";

function AuthSync() {
  const { user } = useUser();
  const { setUser } = useAuthStore();

  useEffect(() => {
    if (user) {
      user.getIdTokenResult().then((idTokenResult) => {
        setUser(user, idTokenResult.claims);
      });
    } else {
      setUser(null);
    }
  }, [user, setUser]);

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

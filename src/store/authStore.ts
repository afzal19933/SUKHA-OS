"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  role: string | null;
  entityId: string | null;
  _hasHydrated: boolean;
  setUser: (user: User | null, claims?: Record<string, any>) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      entityId: null,
      _hasHydrated: false,
      setUser: (user, claims) => set({ 
        user, 
        role: claims?.role || null, 
        entityId: claims?.entityId || null 
      }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'sukha-auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
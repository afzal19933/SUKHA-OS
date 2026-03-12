
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  role: string | null;
  entityId: string | null;
  permissions: string[] | null;
  _hasHydrated: boolean;
  setUser: (user: User | null, claims?: Record<string, any>) => void;
  setRole: (role: string | null) => void;
  setEntityId: (entityId: string | null) => void;
  setPermissions: (permissions: string[] | null) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      entityId: null,
      permissions: null,
      _hasHydrated: false,
      setUser: (user, claims) => {
        const currentEntityId = get().entityId;
        const currentRole = get().role;
        
        set({ 
          user, 
          // Only overwrite role/entityId from claims if they are actually present
          role: claims?.role || currentRole || null, 
          entityId: claims?.entityId || currentEntityId || null 
        });
      },
      setRole: (role) => set({ role }),
      setEntityId: (entityId) => set({ entityId }),
      setPermissions: (permissions) => set({ permissions }),
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

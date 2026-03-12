
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from 'firebase/auth';

interface PropertyInfo {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  role: string | null;
  entityId: string | null;
  permissions: string[] | null;
  availableProperties: PropertyInfo[];
  _hasHydrated: boolean;
  setUser: (user: User | null, claims?: Record<string, any>) => void;
  setRole: (role: string | null) => void;
  setEntityId: (entityId: string | null) => void;
  setPermissions: (permissions: string[] | null) => void;
  setAvailableProperties: (properties: PropertyInfo[]) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      entityId: null,
      permissions: null,
      availableProperties: [],
      _hasHydrated: false,
      setUser: (user, claims) => {
        const currentEntityId = get().entityId;
        const currentRole = get().role;
        
        set({ 
          user, 
          role: claims?.role || currentRole || null, 
          entityId: claims?.entityId || currentEntityId || null 
        });
      },
      setRole: (role) => set({ role }),
      setEntityId: (entityId) => set({ entityId }),
      setPermissions: (permissions) => set({ permissions }),
      setAvailableProperties: (availableProperties) => set({ availableProperties }),
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

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
  userName: string | null;
  role: string | null;
  entityId: string | null; // Currently active session entity
  assignedEntityId: string | null; // Entity ID from profile (could be 'all')
  permissions: string[] | null;
  theme: string | null;
  availableProperties: PropertyInfo[];
  _hasHydrated: boolean;
  setUser: (user: User | null, claims?: Record<string, any>) => void;
  setUserName: (name: string | null) => void;
  setRole: (role: string | null) => void;
  setEntityId: (entityId: string | null) => void;
  setAssignedEntityId: (id: string | null) => void;
  setPermissions: (permissions: string[] | null) => void;
  setTheme: (theme: string | null) => void;
  setAvailableProperties: (properties: PropertyInfo[]) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userName: null,
      role: null,
      entityId: null,
      assignedEntityId: null,
      permissions: null,
      theme: 'default',
      availableProperties: [],
      _hasHydrated: false,
      setUser: (user, claims) => {
        // If logging out, clear everything
        if (!user) {
          set({ 
            user: null, 
            role: null, 
            entityId: null,
            userName: null,
            permissions: null,
            assignedEntityId: null
          });
          return;
        }
        
        // Update user and claims (roles/entities)
        set({ 
          user, 
          role: claims?.role || null, 
          entityId: claims?.entityId || null 
        });
      },
      setUserName: (userName) => set({ userName }),
      setRole: (role) => set({ role }),
      setEntityId: (entityId) => set({ entityId }),
      setAssignedEntityId: (assignedEntityId) => set({ assignedEntityId }),
      setPermissions: (permissions) => set({ permissions }),
      setTheme: (theme) => set({ theme }),
      setAvailableProperties: (availableProperties) => set({ availableProperties }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'sukha-auth-storage',
      // Only persist UI-related settings like theme to prevent state leakage
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

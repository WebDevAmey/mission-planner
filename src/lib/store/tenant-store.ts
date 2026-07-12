import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Tenant {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  missionIds: string[];
}

const TENANT_COLORS = [
  '#2d7dd2', '#00cc66', '#ff6b35', '#9b59b6',
  '#e74c3c', '#f39c12', '#1abc9c', '#e67e22',
];

let colorIdx = 0;
const nextColor = () => TENANT_COLORS[colorIdx++ % TENANT_COLORS.length];

interface TenantStoreState {
  tenants: Record<string, Tenant>;
  activeTenantId: string | null;
  createTenant: (name: string, color?: string) => string;
  switchTenant: (id: string) => void;
  renameTenant: (id: string, name: string) => void;
  deleteTenant: (id: string) => void;
  assignMissionToTenant: (missionId: string, tenantId: string) => void;
  removeMissionFromTenant: (missionId: string, tenantId: string) => void;
  getActiveTenant: () => Tenant | null;
  ensureDefault: (existingMissionIds: string[]) => void;
}

export const useTenantStore = create<TenantStoreState>()(
  persist(
    (set, get) => ({
      tenants: {},
      activeTenantId: null,

      createTenant: (name, color) => {
        const id = uuidv4();
        const tenant: Tenant = {
          id,
          name: name.trim() || 'Organisation',
          color: color ?? nextColor(),
          createdAt: new Date().toISOString(),
          missionIds: [],
        };
        set((s) => ({
          tenants: { ...s.tenants, [id]: tenant },
          activeTenantId: s.activeTenantId ?? id,
        }));
        return id;
      },

      switchTenant: (id) => {
        if (get().tenants[id]) set({ activeTenantId: id });
      },

      renameTenant: (id, name) => {
        if (!name.trim()) return;
        set((s) => ({
          tenants: {
            ...s.tenants,
            [id]: { ...s.tenants[id], name: name.trim() },
          },
        }));
      },

      deleteTenant: (id) => {
        const state = get();
        const keys = Object.keys(state.tenants);
        if (keys.length <= 1) return;
        const next = keys.find((k) => k !== id);
        const updated = { ...state.tenants };
        delete updated[id];
        set({
          tenants: updated,
          activeTenantId: state.activeTenantId === id ? (next ?? null) : state.activeTenantId,
        });
      },

      assignMissionToTenant: (missionId, tenantId) => {
        set((s) => {
          const tenant = s.tenants[tenantId];
          if (!tenant) return s;
          if (tenant.missionIds.includes(missionId)) return s;
          return {
            tenants: {
              ...s.tenants,
              [tenantId]: {
                ...tenant,
                missionIds: [...tenant.missionIds, missionId],
              },
            },
          };
        });
      },

      removeMissionFromTenant: (missionId, tenantId) => {
        set((s) => {
          const tenant = s.tenants[tenantId];
          if (!tenant) return s;
          return {
            tenants: {
              ...s.tenants,
              [tenantId]: {
                ...tenant,
                missionIds: tenant.missionIds.filter((id) => id !== missionId),
              },
            },
          };
        });
      },

      getActiveTenant: () => {
        const { tenants, activeTenantId } = get();
        return activeTenantId ? (tenants[activeTenantId] ?? null) : null;
      },

      ensureDefault: (existingMissionIds) => {
        const state = get();
        if (Object.keys(state.tenants).length > 0) return;
        const id = uuidv4();
        const tenant: Tenant = {
          id,
          name: 'Default Organisation',
          color: TENANT_COLORS[0],
          createdAt: new Date().toISOString(),
          missionIds: existingMissionIds,
        };
        set({ tenants: { [id]: tenant }, activeTenantId: id });
      },
    }),
    {
      name: 'mps-tenant-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

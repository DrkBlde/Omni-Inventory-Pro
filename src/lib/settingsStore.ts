import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

export interface AppSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  currency: string;
  gstNumber: string;
  storeLogo: string;
  defaultBillType: 'GST' | 'Normal';
  gstPercentage: number;
  useFullDate: boolean;
  enableExpiryBlocking: boolean;
  dashboardWidgets: string[];
}

interface SettingsState {
  settings: AppSettings;
  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => void;
  refreshFromServer: () => Promise<void>;
  isOnline: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'Omni Inventory Pro',
  storeAddress: '',
  storePhone: '',
  currency: '₹',
  gstNumber: '',
  storeLogo: '',
  defaultBillType: 'Normal',
  gstPercentage: 0,
  useFullDate: false,
  enableExpiryBlocking: true,
  dashboardWidgets: ['stats', 'charts', 'alerts'],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isOnline: false,

      refreshFromServer: async () => {
        try {
          const serverSettings = await api.settings.getAll();
          set({
            settings: { ...DEFAULT_SETTINGS, ...serverSettings },
            isOnline: true,
          });
        } catch (err) {
          set({ isOnline: false });
        }
      },

      updateSettings: async (data) => {
        try {
          const updated = await api.settings.update(data);
          set({ settings: { ...get().settings, ...updated }, isOnline: true });
        } catch (err) {
          // Fallback to local update
          set((state) => ({
            settings: { ...state.settings, ...data }
          }));
        }
      },

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'omni-settings-storage',
    }
  )
);

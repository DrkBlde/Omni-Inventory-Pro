import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface SettingsState {
  settings: AppSettings;
  updateSettings: (data: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'My Store',
  storeAddress: '',
  storePhone: '',
  currency: '₹',
  gstNumber: '',
  storeLogo: '',
  defaultBillType: 'GST',
  gstPercentage: 18,
  useFullDate: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (data) => set((state) => ({
        settings: { ...state.settings, ...data }
      })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'omni-settings-storage',
    }
  )
);

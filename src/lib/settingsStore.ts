import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

const API_URL = 'http://localhost:3001/api';

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
  inactivityTimeout: number; // minutes, 0 = disabled
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
  inactivityTimeout: 10,
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

      updateSettings: async (newSettings) => {
        try {
          const token = localStorage.getItem('omni_token');
          
          // Merge current state with new changes to ensure ID and all fields exist
          const currentSettings = get().settings;
          const fullPayload = { ...currentSettings, ...newSettings };

          const response = await fetch(`${API_URL}/settings`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(fullPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText}`);
          }

          // Server just returns {message}, so we update local state directly
          set((state) => ({ 
            settings: { ...state.settings, ...newSettings },
            isOnline: true 
          }));
          
        } catch (error) {
          console.error("Critical Sync Error:", error);
          throw error;
        }
      },

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'omni-settings-storage',
    }
  )
);
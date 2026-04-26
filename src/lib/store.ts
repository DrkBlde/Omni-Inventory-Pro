import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, checkServerConnection } from './api';

// --- TYPES ---
export interface Batch { id: string; batchNo: string; mfgDate: string; expiryDate: string; quantity: number; }
export interface User { id: string; username: string; fullName: string; role: string; isActive: boolean; createdAt: string; }
export interface Role { id: string; name: string; permissions: string[]; }

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  batches: Batch[];
  quantity: number;
  lowStockThreshold: number;
  veryLowStockThreshold: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpiryAlert {
  productId: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  daysRemaining: number;
  type: 'EXPIRED' | 'SOON';
}

export interface AuditEntry { id: string; productId: string; productName: string; field: string; oldValue: string; newValue: string; userId: string; userName: string; timestamp: string; }
export interface BillItem { productId: string; name: string; price: number; quantity: number; batchNo?: string; }
export interface Payment { method: 'cash' | 'upi' | 'card'; amount: number; }

export interface Bill {
  id: string;
  billNumber: number;
  items: BillItem[];
  payments: Payment[];
  total: number;
  taxableAmount: number;
  totalGst: number;
  gstPercentage: number;
  gstNumber: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  customerId?: string;
  customerName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  isCancelled: boolean;
  cancelledBy?: string;
  cancelledAt?: string;
  billType: 'GST' | 'Normal';
}

export interface Customer { id: string; name: string; phone: string; }
export interface ClockEntry { id: string; userId: string; userName: string; clockIn: string; clockOut?: string; }

export interface Settings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  currency: string;
  gstNumber: string;
  gstPercentage: number;
  defaultBillType: 'GST' | 'Normal';
  enableExpiryBlocking: boolean;
  dashboardWidgets: string[];
}

interface SyncState {
  isOnline: boolean;
  lastSync: string | null;
  syncError: string | null;
}

interface AppState extends SyncState {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  users: User[];
  addUser: (user: Omit<User, 'id' | 'createdAt'>, password: string) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
  roles: Role[];
  addRole: (role: Omit<Role, 'id'>) => void;
  updateRole: (id: string, data: Partial<Role>) => void;
  deleteRole: (id: string) => void;
  products: Product[];
  getAvailableProducts: () => Product[];
  getExpiryAlerts: () => ExpiryAlert[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantity'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateBatch: (productId: string, batchId: string, data: Partial<Batch>) => Promise<void>;
  deleteBatch: (productId: string, batchId: string) => Promise<void>;
  auditTrail: AuditEntry[];
  bills: Bill[];
  nextBillNumber: number;
  settings: Settings;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
  createBill: (items: BillItem[], payments: Payment[], customer?: Customer, externalSettings?: any) => Promise<Bill>;
  updateBill: (id: string, items: BillItem[], payments: Payment[], customer?: Customer, externalSettings?: any) => Promise<void>;
  cancelBill: (id: string) => Promise<void>;
  reinstateBill: (id: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  clockEntries: ClockEntry[];
  clockIn: (userId: string) => void;
  clockOut: (userId: string) => void;
  getActiveClockEntry: (userId: string) => ClockEntry | undefined;
  _passwords: Record<string, string>;
  refreshFromServer: () => Promise<void>;
  setOnline: (online: boolean) => void;
  startAutoSync: (intervalMs?: number) => void;
  stopAutoSync: () => void;
  _syncInterval: NodeJS.Timeout | null;
}

const ALL_PERMISSIONS = [
  'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete',
  'pos.access', 'pos.cancel_bill', 'reports.view', 'reports.export',
  'users.view', 'users.manage', 'users.reactivate', 'roles.manage', 'settings.manage',
  'bills.reinstate',
  'settings.expiry_alerts',
  'dashboard.view',
  'dashboard.customize',
  'inventory.delete_batch'
];

const generateId = () => crypto.randomUUID();
const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
};

const calcQty = (batches: Batch[]) => batches.reduce((sum, b) => sum + b.quantity, 0);

const getDaysRemaining = (dateStr: string) => {
  if (!dateStr) return 0;
  const exp = new Date(dateStr);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Default settings
const DEFAULT_SETTINGS: Settings = {
  storeName: 'Omni Inventory Pro',
  storeAddress: '',
  storePhone: '',
  currency: '₹',
  gstNumber: '',
  gstPercentage: 0,
  defaultBillType: 'Normal',
  enableExpiryBlocking: true,
  dashboardWidgets: ['stats', 'charts', 'alerts']
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Sync state
      isOnline: false,
      lastSync: null,
      syncError: null,

      currentUser: null,
      isAuthenticated: false,

      // Login - REQUIRES server authentication
      login: async (username, password) => {
        try {
          const result = await api.auth.login(username, password);
          localStorage.setItem('auth-token', JSON.stringify(result.token));

          // Fetch initial data from server
          await get().refreshFromServer();

          set({
            currentUser: result.user,
            isAuthenticated: true,
            isOnline: true,
            syncError: null,
            lastSync: new Date().toISOString()
          });

          const active = get().clockEntries.find(e => e.userId === result.user.id && !e.clockOut);
          if (!active) get().clockIn(result.user.id);

          return true;
        } catch (err: any) {
          set({
            syncError: `Server unavailable: ${err.message}. Please ensure the backend server is running.`,
            isOnline: false
          });
          return false;
        }
      },

      logout: () => {
        const state = get();
        if (state.currentUser) state.clockOut(state.currentUser.id);
        localStorage.removeItem('auth-token');
        set({ currentUser: null, isAuthenticated: false });
      },

      users: [{ id: 'admin-001', username: 'admin', fullName: 'Administrator', role: 'Admin', isActive: true, createdAt: new Date().toISOString() }],

      addUser: async (user, password) => {
        try {
          const newUser = await api.users.create({ ...user, password } as any);
          set(s => ({ users: [...s.users, newUser] }));
        } catch (err) {
          // Fallback to local
          const id = generateId();
          set(s => ({
            users: [...s.users, { ...user, id, createdAt: new Date().toISOString() }],
            _passwords: { ...s._passwords, [id]: simpleHash(password) },
          }));
        }
      },

      updateUser: async (id, data) => {
        try {
          const updated = await api.users.update(id, data);
          set(s => ({ users: s.users.map(u => u.id === id ? updated : u) }));
        } catch (err) {
          set(s => ({ users: s.users.map(u => u.id === id ? { ...u, ...data } : u) }));
        }
      },

      deactivateUser: async (id) => {
        try {
          await api.users.delete(id);
          set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: false } : u) }));
        } catch (err) {
          set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: false } : u) }));
        }
      },

      activateUser: async (id) => {
        try {
          await api.users.update(id, { isActive: true });
          set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: true } : u) }));
        } catch (err) {
          set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: true } : u) }));
        }
      },

      resetPassword: async (id, newPassword) => {
        try {
          await api.users.resetPassword(id, newPassword);
        } catch (err) {
          set(s => ({ _passwords: { ...s._passwords, [id]: simpleHash(newPassword) } }));
        }
      },

      roles: [
        { id: 'role-admin', name: 'Admin', permissions: ALL_PERMISSIONS },
        { id: 'role-manager', name: 'Manager', permissions: ALL_PERMISSIONS.filter(p => p !== 'roles.manage') },
        { id: 'role-cashier', name: 'Cashier', permissions: ['inventory.view', 'pos.access'] },
      ],
      addRole: (role) => set(s => ({ roles: [...s.roles, { ...role, id: generateId() }] })),
      updateRole: (id, data) => set(s => ({ roles: s.roles.map(r => r.id === id ? { ...r, ...data } : r) })),
      deleteRole: (id) => set(s => ({ roles: s.roles.filter(r => r.id !== id) })),

      products: [],

      refreshFromServer: async () => {
        try {
          const online = await checkServerConnection();
          if (!online) {
            set({ isOnline: false, syncError: 'Server unavailable' });
            return;
          }

          const [products, bills, customers, settings, users] = await Promise.all([
            api.products.getAll().catch(() => []),
            api.bills.getAll().catch(() => []),
            api.customers.getAll().catch(() => []),
            api.settings.getAll().catch(() => ({})),
            api.users.getAll().catch(() => []),
          ]);

          console.log('[Store.refreshFromServer] bills from API:', bills);

          // Transform server data to match store format
          const transformedProducts = (products || []).map((p: any) => ({
            ...p,
            quantity: calcQty(p.batches || []),
          }));

          const transformedBills = (bills || []).map((b: any) => ({
            ...b,
            payments: b.payments || [],
            customerName: b.customer?.name || (b.customerId ? 'Unknown' : 'Walk-in'),
            createdByName: b.createdByName || b.creator?.fullName || b.creator?.username || 'Unknown',
            items: (b.items || []).map((item: any) => ({
              productId: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              batchNo: item.batchNo,
            })),
          }));

          console.log('[Store.refreshFromServer] transformed bills:', transformedBills);

          set({
            isOnline: true,
            lastSync: new Date().toISOString(),
            syncError: null,
            products: transformedProducts,
            bills: transformedBills,
            customers: customers || [],
            settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
            users: users || get().users,
          });
        } catch (err: any) {
          console.error('[Store.refreshFromServer] error:', err);
          set({ isOnline: false, syncError: err.message });
        }
      },

      // Auto-sync interval (for real-time updates across devices)
      _syncInterval: null as NodeJS.Timeout | null,
      startAutoSync: (intervalMs = 5000) => {
        const state = get();
        if (state._syncInterval) clearInterval(state._syncInterval);

        const interval = setInterval(() => {
          // Always use the latest refreshFromServer from the store
          useAppStore.getState().refreshFromServer();
        }, intervalMs);

        set({ _syncInterval: interval });
      },
      stopAutoSync: () => {
        const state = get();
        if (state._syncInterval) {
          clearInterval(state._syncInterval);
          set({ _syncInterval: null });
        }
      },

      getAvailableProducts: () => {
        const { products, settings } = get();
        if (!settings.enableExpiryBlocking) return products;

        return products.map(p => {
          const validBatches = p.batches.filter(b => getDaysRemaining(b.expiryDate) > 0);
          return { ...p, batches: validBatches, quantity: calcQty(validBatches) };
        }).filter(p => p.quantity > 0);
      },

      getExpiryAlerts: () => {
        const { products } = get();
        const alerts: ExpiryAlert[] = [];

        products.forEach(p => {
          p.batches.forEach(b => {
            if (b.quantity <= 0) return;
            const days = getDaysRemaining(b.expiryDate);

            if (days <= 0) {
              alerts.push({
                productId: p.id, productName: p.name, batchNo: b.batchNo,
                expiryDate: b.expiryDate, daysRemaining: days, type: 'EXPIRED'
              });
            } else if (days <= 30) {
              alerts.push({
                productId: p.id, productName: p.name, batchNo: b.batchNo,
                expiryDate: b.expiryDate, daysRemaining: days, type: 'SOON'
              });
            }
          });
        });
        return alerts;
      },

      addProduct: async (product) => {
        try {
          const newProduct = await api.products.create(product as any);
          set(s => ({ products: [...s.products, { ...newProduct, quantity: calcQty(newProduct.batches) }] }));
        } catch (err) {
          const now = new Date().toISOString();
          set(s => ({
            products: [...s.products, { ...product, id: generateId(), quantity: calcQty(product.batches), createdAt: now, updatedAt: now }]
          }));
        }
      },

      updateProduct: async (id, data) => {
        try {
          const updated = await api.products.update(id, data as any);
          set(s => ({
            products: s.products.map(p => p.id === id ? { ...updated, quantity: calcQty(updated.batches) } : p),
          }));
        } catch (err) {
          const state = get();
          set(s => ({
            products: s.products.map(p => {
              if (p.id !== id) return p;
              const updated = { ...p, ...data, updatedAt: new Date().toISOString() };
              updated.quantity = calcQty(updated.batches);
              return updated;
            }),
          }));
        }
      },

      deleteProduct: async (id) => {
        try {
          await api.products.delete(id);
          set(s => ({ products: s.products.filter(p => p.id !== id) }));
        } catch (err) {
          set(s => ({ products: s.products.filter(p => p.id !== id) }));
        }
      },

      updateBatch: async (productId, batchId, data) => {
        try {
          await api.products.update(productId, {
            batches: get().products.find(p => p.id === productId)?.batches.map(b =>
              b.id === batchId ? { ...b, ...data } : b
            )
          });
          set(s => ({
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const newBatches = p.batches.map(b => b.id === batchId ? { ...b, ...data } : b);
              return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
            })
          }));
        } catch (err) {
          set(s => ({
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const newBatches = p.batches.map(b => b.id === batchId ? { ...b, ...data } : b);
              return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
            })
          }));
        }
      },

      deleteBatch: async (productId, batchId) => {
        try {
          await api.products.deleteBatch(productId, batchId);
          set(s => ({
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const newBatches = p.batches.filter(b => b.id !== batchId);
              return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
            })
          }));
        } catch (err) {
          set(s => ({
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const newBatches = p.batches.filter(b => b.id !== batchId);
              return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
            })
          }));
        }
      },

      settings: DEFAULT_SETTINGS,

      updateSettings: async (data) => {
        try {
          const updated = await api.settings.update(data);
          set(s => ({ settings: { ...s.settings, ...updated } }));
        } catch (err) {
          set(s => ({ settings: { ...s.settings, ...data } }));
        }
      },

      auditTrail: [],
      bills: [],
      nextBillNumber: 1001,

      createBill: async (items, payments, customer, externalSettings) => {
        const state = get();
        const currentSettings = { ...state.settings, ...externalSettings };
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const gstRate = Number(currentSettings.gstPercentage) || 0;
        const taxableAmount = gstRate > 0 ? subtotal / (1 + (gstRate / 100)) : subtotal;
        const totalGst = subtotal - taxableAmount;

        const billData = {
          items,
          payments,
          customerId: customer?.id,
          gstPercentage: gstRate,
          gstNumber: currentSettings.gstNumber || '',
          storeName: currentSettings.storeName || 'Omni Inventory Pro',
          storeAddress: currentSettings.storeAddress || '',
          storePhone: currentSettings.storePhone || '',
          billType: currentSettings.defaultBillType,
        };

        try {
          const createdBill = await api.bills.create(billData);

          const bill: Bill = {
            id: createdBill.id,
            billNumber: createdBill.billNumber,
            items: createdBill.items,
            payments,
            total: subtotal,
            taxableAmount: Number(taxableAmount.toFixed(2)),
            totalGst: Number(totalGst.toFixed(2)),
            gstPercentage: gstRate,
            gstNumber: currentSettings.gstNumber || '',
            storeName: currentSettings.storeName || 'Omni Inventory Pro',
            storeAddress: currentSettings.storeAddress || '',
            storePhone: currentSettings.storePhone || '',
            customerId: customer?.id,
            customerName: customer?.name || 'Walk-in',
            createdBy: state.currentUser?.id || '',
            createdByName: state.currentUser?.fullName || '',
            createdAt: new Date().toISOString(),
            isCancelled: false,
            billType: currentSettings.defaultBillType,
          };

          // Update local state immediately for instant UI feedback
          set(s => ({
            bills: [...s.bills, bill],
            nextBillNumber: s.nextBillNumber + 1,
          }));

          // Refresh from server in background to sync stock and ensure consistency
          // Don't await this - let it happen in background so print shows immediately
          state.refreshFromServer().catch(console.error);

          return bill;
        } catch (err) {
          // Fallback to local creation
          const bill: Bill = {
            id: generateId(),
            billNumber: state.nextBillNumber,
            items,
            payments,
            total: subtotal,
            taxableAmount: Number(taxableAmount.toFixed(2)),
            totalGst: Number(totalGst.toFixed(2)),
            gstPercentage: gstRate,
            gstNumber: currentSettings.gstNumber || '',
            storeName: currentSettings.storeName || 'Omni Inventory Pro',
            storeAddress: currentSettings.storeAddress || '',
            storePhone: currentSettings.storePhone || '',
            customerId: customer?.id,
            customerName: customer?.name || 'Walk-in',
            createdBy: state.currentUser?.id || '',
            createdByName: state.currentUser?.fullName || '',
            createdAt: new Date().toISOString(),
            isCancelled: false,
            billType: currentSettings.defaultBillType,
          };

          const updatedProducts = state.products.map(p => {
            const item = items.find(i => i.productId === p.id);
            if (item) {
              let remainingToDeduct = item.quantity;
              const updatedBatches = p.batches.map(batch => {
                if (remainingToDeduct <= 0 || (state.settings.enableExpiryBlocking && getDaysRemaining(batch.expiryDate) <= 0)) return batch;
                const deduct = Math.min(batch.quantity, remainingToDeduct);
                remainingToDeduct -= deduct;
                return { ...batch, quantity: batch.quantity - deduct };
              });
              return { ...p, batches: updatedBatches, quantity: calcQty(updatedBatches), updatedAt: new Date().toISOString() };
            }
            return p;
          });

          set(s => ({
            bills: [...s.bills, bill],
            nextBillNumber: s.nextBillNumber + 1,
            products: updatedProducts,
          }));
          return bill;
        }
      },

      updateBill: async (id, items, payments, customer, externalSettings) => {
        // For simplicity, this updates locally - can be enhanced to sync with server
        const state = get();
        const billIndex = state.bills.findIndex(b => b.id === id);
        if (billIndex === -1) return;

        const oldBill = state.bills[billIndex];
        const currentSettings = { ...state.settings, ...externalSettings };
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const gstRate = Number(currentSettings.gstPercentage) || 0;
        const taxableAmount = gstRate > 0 ? subtotal / (1 + (gstRate / 100)) : subtotal;
        const totalGst = subtotal - taxableAmount;

        let updatedProducts = [...state.products];

        oldBill.items.forEach(oldItem => {
          updatedProducts = updatedProducts.map(p => {
            if (p.id !== oldItem.productId) return p;
            const updatedBatches = p.batches.map(b =>
              b.batchNo === oldItem.batchNo ? { ...b, quantity: b.quantity + oldItem.quantity } : b
            );
            return { ...p, batches: updatedBatches, quantity: calcQty(updatedBatches) };
          });
        });

        items.forEach(newItem => {
          updatedProducts = updatedProducts.map(p => {
            if (p.id !== newItem.productId) return p;
            let remaining = newItem.quantity;
            const updatedBatches = p.batches.map(b => {
              if (remaining <= 0 || (state.settings.enableExpiryBlocking && getDaysRemaining(b.expiryDate) <= 0)) return b;
              const deduct = Math.min(b.quantity, remaining);
              remaining -= deduct;
              return { ...b, quantity: b.quantity - deduct };
            });
            return { ...p, batches: updatedBatches, quantity: calcQty(updatedBatches), updatedAt: new Date().toISOString() };
          });
        });

        const updatedBill: Bill = {
          ...oldBill, items, payments, total: subtotal,
          taxableAmount: Number(taxableAmount.toFixed(2)),
          totalGst: Number(totalGst.toFixed(2)),
          gstPercentage: gstRate,
          customerId: customer?.id,
          customerName: customer?.name || 'Walk-in',
          updatedAt: new Date().toISOString(),
        };

        const newBills = [...state.bills];
        newBills[billIndex] = updatedBill;

        set({ bills: newBills, products: updatedProducts });
      },

      cancelBill: async (id: string) => {
        try {
          await api.bills.cancel(id);
          await get().refreshFromServer();
        } catch (err) {
          set((s) => {
            const bill = s.bills.find(b => b.id === id);
            if (!bill) return s;

            const updatedProducts = s.products.map(p => {
              const billItem = bill.items.find(item => item.productId === p.id);
              if (billItem) {
                const updatedBatches = p.batches.map(batch =>
                  batch.batchNo === billItem.batchNo
                    ? { ...batch, quantity: batch.quantity + billItem.quantity }
                    : batch
                );
                return { ...p, batches: updatedBatches, quantity: calcQty(updatedBatches) };
              }
              return p;
            });

            return {
              products: updatedProducts,
              bills: s.bills.map(b => b.id === id ? {
                ...b, isCancelled: true, cancelledBy: s.currentUser?.fullName || 'System', cancelledAt: new Date().toISOString()
              } : b),
            };
          });
        }
      },

      reinstateBill: async (id: string) => {
        try {
          await api.bills.reinstate(id);
          await get().refreshFromServer();
        } catch (err) {
          set((s) => {
            const bill = s.bills.find(b => b.id === id);
            if (!bill) return s;

            const updatedProducts = s.products.map(p => {
              const billItem = bill.items.find(item => item.productId === p.id);
              if (billItem) {
                const updatedBatches = p.batches.map(batch =>
                  batch.batchNo === billItem.batchNo
                    ? { ...batch, quantity: Math.max(0, batch.quantity - billItem.quantity) }
                    : batch
                );
                return { ...p, batches: updatedBatches, quantity: calcQty(updatedBatches) };
              }
              return p;
            });

            return {
              products: updatedProducts,
              bills: s.bills.map(b => b.id === id ? {
                ...b, isCancelled: false, cancelledBy: undefined, cancelledAt: undefined,
              } : b),
            };
          });
        }
      },

      hasPermission: (permission) => {
        const state = get();
        if (!state.currentUser) return false;
        if (state.currentUser.role === 'Admin') return true;

        const role = state.roles.find(r => r.name === state.currentUser!.role);

        // bills.reinstate is Admin-only
        if (permission === 'bills.reinstate') return false;

        return role?.permissions.includes(permission) ?? false;
      },

      customers: [],

      addCustomer: async (customer) => {
        try {
          const newCustomer = await api.customers.create(customer);
          set(s => ({ customers: [...s.customers, newCustomer] }));
        } catch (err) {
          set(s => ({ customers: [...s.customers, { ...customer, id: generateId() }] }));
        }
      },

      updateCustomer: async (id, data) => {
        try {
          const updated = await api.customers.update(id, data);
          set(s => ({ customers: s.customers.map(c => c.id === id ? updated : c) }));
        } catch (err) {
          set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...data } : c) }));
        }
      },

      clockEntries: [],
      clockIn: (userId) => {
        const user = get().users.find(u => u.id === userId);
        set(s => ({
          clockEntries: [...s.clockEntries, {
            id: generateId(), userId, userName: user?.fullName || '', clockIn: new Date().toISOString(),
          }]
        }));
      },
      clockOut: (userId) => {
        set(s => ({
          clockEntries: s.clockEntries.map(e => e.userId === userId && !e.clockOut ? { ...e, clockOut: new Date().toISOString() } : e)
        }));
      },
      getActiveClockEntry: (userId) => get().clockEntries.find(e => e.userId === userId && !e.clockOut),

      _passwords: { 'admin-001': simpleHash('admin123') },

      setOnline: (online) => set({ isOnline: online }),
    }),
    {
      name: 'omni-main-db',
      version: 5,
      migrate: (persistedState: any, version: number) => {
        if (version < 4) {
          return { ...persistedState, customers: [] };
        }
        if (version < 5) {
          // Add sync state to persisted data
          return {
            ...persistedState,
            isOnline: false,
            lastSync: null,
            syncError: null,
          };
        }
        return persistedState;
      }
    }
  )
);

export { ALL_PERMISSIONS };

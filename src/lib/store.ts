import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  users: User[];
  addUser: (user: Omit<User, 'id' | 'createdAt'>, password: string) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deactivateUser: (id: string) => void;
  activateUser: (id: string) => void; // ADDED
  resetPassword: (id: string, newPassword: string) => void;
  roles: Role[];
  addRole: (role: Omit<Role, 'id'>) => void;
  updateRole: (id: string, data: Partial<Role>) => void;
  deleteRole: (id: string) => void;
  products: Product[];
  getAvailableProducts: () => Product[]; 
  getExpiryAlerts: () => ExpiryAlert[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantity'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  updateBatch: (productId: string, batchId: string, data: Partial<Batch>) => void;
  deleteBatch: (productId: string, batchId: string) => void;
  auditTrail: AuditEntry[];
  bills: Bill[];
  nextBillNumber: number;
  settings: Settings; 
  updateSettings: (data: Partial<Settings>) => void;
  createBill: (items: BillItem[], payments: Payment[], customer?: Customer, externalSettings?: any) => Bill;
  updateBill: (id: string, items: BillItem[], payments: Payment[], customer?: Customer, externalSettings?: any) => void;
  cancelBill: (id: string) => void;
  reinstateBill: (id: string) => void;
  hasPermission: (permission: string) => boolean;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  clockEntries: ClockEntry[];
  clockIn: (userId: string) => void;
  clockOut: (userId: string) => void;
  getActiveClockEntry: (userId: string) => ClockEntry | undefined;
  _passwords: Record<string, string>;
}

// ADDED 'users.reactivate' TO PERMISSIONS
const ALL_PERMISSIONS = [
  'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete',
  'pos.access', 'pos.cancel_bill', 'reports.view', 'reports.export',
  'users.view', 'users.manage', 'users.reactivate', 'roles.manage', 'settings.manage',
  'bills.reinstate', 
  'settings.expiry_alerts'
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      login: (username, password) => {
        const state = get();
        const user = state.users.find(u => u.username === username && u.isActive);
        if (!user) return false;
        const stored = state._passwords[user.id];
        if (stored !== simpleHash(password)) return false;
        set({ currentUser: user, isAuthenticated: true });
        const active = state.clockEntries.find(e => e.userId === user.id && !e.clockOut);
        if (!active) get().clockIn(user.id);
        return true;
      },
      logout: () => {
        const state = get();
        if (state.currentUser) state.clockOut(state.currentUser.id);
        set({ currentUser: null, isAuthenticated: false });
      },

      users: [{ id: 'admin-001', username: 'admin', fullName: 'Administrator', role: 'Admin', isActive: true, createdAt: new Date().toISOString() }],
      addUser: (user, password) => {
        const id = generateId();
        set(s => ({
          users: [...s.users, { ...user, id, createdAt: new Date().toISOString() }],
          _passwords: { ...s._passwords, [id]: simpleHash(password) },
        }));
      },
      updateUser: (id, data) => set(s => ({ users: s.users.map(u => u.id === id ? { ...u, ...data } : u) })),
      deactivateUser: (id) => set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: false } : u) })),
      
      // ADDED ACTIVATE USER LOGIC
      activateUser: (id) => set(s => ({ users: s.users.map(u => u.id === id ? { ...u, isActive: true } : u) })),
      
      resetPassword: (id, newPassword) => set(s => ({ _passwords: { ...s._passwords, [id]: simpleHash(newPassword) } })),

      roles: [
        { id: 'role-admin', name: 'Admin', permissions: ALL_PERMISSIONS },
        { id: 'role-manager', name: 'Manager', permissions: ALL_PERMISSIONS.filter(p => p !== 'roles.manage') },
        { id: 'role-cashier', name: 'Cashier', permissions: ['inventory.view', 'pos.access'] },
      ],
      addRole: (role) => set(s => ({ roles: [...s.roles, { ...role, id: generateId() }] })),
      updateRole: (id, data) => set(s => ({ roles: s.roles.map(r => r.id === id ? { ...r, ...data } : r) })),
      deleteRole: (id) => set(s => ({ roles: s.roles.filter(r => r.id !== id) })),

      products: [],

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

      addProduct: (product) => {
        const now = new Date().toISOString();
        set(s => ({ 
          products: [...s.products, { ...product, id: generateId(), quantity: calcQty(product.batches), createdAt: now, updatedAt: now }] 
        }));
      },
      updateProduct: (id, data) => {
        const state = get();
        const old = state.products.find(p => p.id === id);
        if (!old) return;
        const entries: AuditEntry[] = [];
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'batches' && key in old && (old as any)[key] !== value) {
            entries.push({
              id: generateId(), productId: id, productName: old.name, field: key,
              oldValue: String((old as any)[key]), newValue: String(value),
              userId: state.currentUser?.id || 'system', userName: state.currentUser?.fullName || 'System',
              timestamp: new Date().toISOString(),
            });
          }
        }
        set(s => ({
          products: s.products.map(p => {
            if (p.id !== id) return p;
            const updated = { ...p, ...data, updatedAt: new Date().toISOString() };
            updated.quantity = calcQty(updated.batches);
            return updated;
          }),
          auditTrail: [...s.auditTrail, ...entries],
        }));
      },
      deleteProduct: (id) => set(s => ({ products: s.products.filter(p => p.id !== id) })),

      updateBatch: (productId, batchId, data) => set(s => ({
        products: s.products.map(p => {
          if (p.id !== productId) return p;
          const newBatches = p.batches.map(b => b.id === batchId ? { ...b, ...data } : b);
          return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
        })
      })),

      deleteBatch: (productId, batchId) => set(s => ({
        products: s.products.map(p => {
          if (p.id !== productId) return p;
          const newBatches = p.batches.filter(b => b.id !== batchId);
          return { ...p, batches: newBatches, quantity: calcQty(newBatches), updatedAt: new Date().toISOString() };
        })
      })),

      settings: {
        storeName: 'Omni Inventory Pro',
        storeAddress: '', 
        storePhone: '',   
        currency: '₹',
        gstNumber: '',
        gstPercentage: 0,
        defaultBillType: 'Normal',
        enableExpiryBlocking: true 
      },
      updateSettings: (data) => set(s => ({ settings: { ...s.settings, ...data } })),

      auditTrail: [],
      bills: [],
      nextBillNumber: 1001,

      createBill: (items, payments, customer, externalSettings) => {
        const state = get();
        const currentSettings = { ...state.settings, ...externalSettings };
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const gstRate = Number(currentSettings.gstPercentage) || 0;
        const taxableAmount = gstRate > 0 ? subtotal / (1 + (gstRate / 100)) : subtotal;
        const totalGst = subtotal - taxableAmount;
        
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
      },

      updateBill: (id, items, payments, customer, externalSettings) => {
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

      cancelBill: (id: string) => {
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
      },

      reinstateBill: (id: string) => {
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
      },

      hasPermission: (permission) => {
        const state = get();
        if (!state.currentUser) return false;
        if (state.currentUser.role === 'Admin') return true;

        const role = state.roles.find(r => r.name === state.currentUser!.role);
        return role?.permissions.includes(permission) ?? false;
      },

      customers: [
        { id: 'c1', name: 'Rahul Sharma', phone: '9876543210' },
        { id: 'c2', name: 'Priya Patel', phone: '9876543211' },
      ],
      addCustomer: (customer) => set(s => ({ customers: [...s.customers, { ...customer, id: generateId() }] })),
      updateCustomer: (id, data) => set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...data } : c) })),

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
    }),
    { name: 'omni-main-db', version: 3 } 
  )
);

export { ALL_PERMISSIONS };
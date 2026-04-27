/**
 * OMNI V2 - Inventory Management System
 * Created by: Omni Dev Team
 * Version: 2.2.0
 * License: GPL v3
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore';
import { api } from './api';
import axios from 'axios';


// =========================================================
// 1. CONSTANTS & UTILITIES
// =========================================================

const API_URL = `http://${window.location.hostname || '127.0.0.1'}:3001/api`;

/**
 * Generates a unique ID for local-first records
 */
const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * All available permission strings for RBAC
 */
export const ALL_PERMISSIONS = [
  'dashboard.view', 
  'dashboard.customize', 
  'inventory.view', 
  'inventory.add', 
  'inventory.edit', 
  'inventory.delete', 
  'pos.access',  
  'reports.view', 
  'users.view', 
  'users.manage', 
  'settings.manage', 
  'bills.reinstate',
  'attendance.manage', 
  'attendance.view',
  'roles.view', 
  'roles.manage', 
  'roles.create', 
  'roles.delete'
];

/**
 * Simple hashing for local password fallback
 */
export const simpleHash = (str: string) => {
  if (!str) return "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
};

export const resetSyncLock = () => {

};

// =========================================================
// 2. INTERFACES & TYPES
// =========================================================

export interface BillItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  batchNo?: string;
  taxRate?: number;
  expiryDate?: string;
  selectedBatches?: { 
    batchId: string; 
    batchNo: string; 
    billedQty: number 
  }[]; 
}

export interface Payment {
  method: 'cash' | 'upi' | 'card';
  amount: number;
}

export interface CartItem extends BillItem {}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  checkIn: string;
  checkOut?: string;
  status: 'Present' | 'Absent' | 'Late';
  date: string;
}

export interface Customer { 
  id: string; 
  name: string; 
  phone: string; 
}

export interface Role { 
  id: string; 
  name: string; 
  permissions: string[]; 
}

export interface Batch { 
  id: string; 
  batchNo: string; 
  quantity: number; 
  mfgDate: string; 
  expiryDate: string; 
}

export interface Product {
  id: string; 
  name: string; 
  category: string; 
  sku: string; 
  barcode: string; 
  unit: string;
  price: number; 
  costPrice: number; 
  quantity: number; 
  stock: number;
  minStock: number; 
  lowStockThreshold: number; 
  veryLowStockThreshold: number;
  batches: Batch[]; 
  description?: string; 
  taxRate: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  items: BillItem[];
  total: number;
  customerName: string;
  customerPhone?: string;
  createdAt: string;
  createdByName?: string;
  payments?: Payment[];
  taxableAmount?: number;
  gstPercentage?: number;
  totalGst?: number;
  isCancelled?: boolean;
  cancelledAt?: string;
  billType?: string;
  gstNumber?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export interface User { 
  id: string; 
  username: string; 
  fullName: string; 
  role: string | { name: string; permissions?: string | string[] }; 
  isActive: boolean; 
  isSystem?: boolean; 
}

export interface AppSettings { 
  currency: string; 
  dashboardWidgets: string[]; 
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  address?: string;
  gstNumber?: string;
  gstPercentage?: number;
  defaultBillType?: string;
}

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  users: User[];
  bills: Bill[];
  products: Product[];
  customers: Customer[];
  categories: string[];
  roles: Role[];
  settings: AppSettings;
  attendance: AttendanceRecord[];
  cart: CartItem[];
  nextBillNumber: number;
  _passwords: Record<string, string>;
  
  // Auth Methods
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  syncLogout: () => void;
  
  // Data Methods
  refreshFromServer: () => Promise<void>;
  startAutoSync: (interval?: number) => void;
  stopAutoSync: () => void;
  
  // User Management
  addUser: (data: any) => Promise<void>;
  updateUser: (id: string, data: any) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  resetPassword: (id: string, newPass: string) => Promise<void>;
  
  // Role Management
  addRole: (role: any) => Promise<void>;
  updateRole: (id: string, role: any) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;

  // Inventory Management
  addProduct: (p: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  deleteBatch: (productId: string, batchId: string) => Promise<void>;
  
  // Sales & Billing
  addBill: (b: Partial<Bill> & Record<string, any>) => Promise<Bill>;
  cancelBill: (id: string) => Promise<void>;
  reinstateBill: (id: string) => Promise<void>;
  
  // Cart Management
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  updateCartQuantity: (productId: string, qty: number) => void;
  
  // Customer Management
  addCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer>;
  
  // Attendance
  markAttendance: (userId: string, status: AttendanceRecord['status']) => void;
  checkOut: (recordId: string) => void;

  // System
  hasPermission: (perm: string) => boolean;
  getExpiryAlerts: () => any[];
}

// =========================================================
// 3. STORE DEFINITION
// =========================================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isOnline: true,
      users: [],
      bills: [],
      products: [],
      customers: [],
      categories: ['General', 'Medicine', 'Cosmetics', 'Electronics'],
      roles: [],
      attendance: [],
      cart: [],
      settings: { 
        currency: '₹', 
        dashboardWidgets: ['stats', 'charts', 'alerts'],
        storeName: 'OMNI V2'
      },
      nextBillNumber: 1001,
      _passwords: { 'admin-001': simpleHash('admin123') },


      checkAuth: async () => {
  const token = localStorage.getItem('omni_token');
  if (!token) return;

  try {
    const user = await api.auth.me();
    set({ currentUser: user, isOnline: true });
  } catch (err) {
    // If token is invalid, log out silently
    localStorage.removeItem('omni_token');
    set({ currentUser: null });
  }
},

      // -----------------------------------------------------
      // AUTHENTICATION
      // -----------------------------------------------------

      login: async (username, password) => {
  try {
    // 1. Authenticate via the API client
    const data = await api.auth.login(username, password);

    // 2. Save the token immediately
    localStorage.setItem('omni_token', data.token);
    
    // 3. CRITICAL: Update the state including 'isAuthenticated'
    // Without 'isAuthenticated: true', ProtectedRoute will kick you back to login.
    set({ 
      currentUser: data.user, 
      isAuthenticated: true, 
      isOnline: true 
    });

    // 4. Background Attendance & Refresh
    const baseUrl = sessionStorage.getItem('api_base_url') || '/api';
    
    // Using fire-and-forget for attendance so it doesn't delay navigation
    fetch(`${baseUrl}/attendance/checkin`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({ userId: data.user.id })
    }).finally(() => {
        // Refresh server data once the user is confirmed
        get().refreshFromServer();
    });

    return data.user; 
  } catch (err: any) {
    console.error("Login Error in Store:", err);
    throw err;
  }
},

      logout: async () => {
  // 1. Stop the auto-sync heartbeat immediately
  get().stopAutoSync();

  const { currentUser, attendance } = get();

  // 2. Handle the backend checkout if needed
  if (currentUser) {
    const activeEntry = (attendance || []).find(
      e => e.userId == currentUser.id && !e.checkOut
    );

    if (activeEntry) {
      try {
        const token = localStorage.getItem('omni_token');
        await fetch(`${API_URL}/attendance/${activeEntry.id}/checkout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          }
        });
      } catch (err) {
        console.error("Final checkout failed", err);
      }
    }
  }

  // 3. FINALLY clear local storage and state
  localStorage.removeItem('omni_token');
  set({ 
    currentUser: null, 
    attendance: [], 
    isOnline: false 
  });
},

syncLogout: () => {
  const { currentUser, attendance } = get();
  const activeEntry = attendance.find(e => e.userId === currentUser?.id && !e.checkOut);
  
  if (activeEntry) {
    const url = `${API_URL}/attendance/${activeEntry.id}/checkout`;
    // sendBeacon needs a Blob with correct content-type so the server parses it as JSON
    const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  }
},

      // -----------------------------------------------------
      // DATA SYNCHRONIZATION
      // -----------------------------------------------------

      refreshFromServer: async () => {
  const token = localStorage.getItem('omni_token');
  
  // --- THE FIX: STOP IF LOGGED OUT ---
  if (!token) return; 

  try {
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Now we know token exists
    };
    
    const endpoints = ['products', 'bills', 'users', 'customers', 'attendance', 'roles'];
    
    const results = await Promise.all(
      endpoints.map(ep => 
        fetch(`${API_URL}/${ep}`, { headers })
          .then(res => {
            // Optional: If we get a 401 mid-sync, stop the sync
            if (res.status === 401) return []; 
            return res.ok ? res.json() : [];
          })
          .catch(() => [])
      )
    );



    set({ 
      products: results[0], 
      bills: results[1], 
      users: results[2].filter((u: any) => !u.isSystem),
      customers: results[3],
      attendance: [...results[4]],
      roles: results[5].map((role: any) => ({
  ...role,
  permissions: Array.isArray(role.permissions) 
    ? role.permissions 
    : (typeof role.permissions === 'string' ? JSON.parse(role.permissions) : [])
})),
      isOnline: true 
    });
  } catch (error) {
    console.error("Critical Sync Error:", error);
    set({ isOnline: false });
  }
},

      // -----------------------------------------------------
      // USER & ROLE MANAGEMENT
      // -----------------------------------------------------

      addUser: async (userData) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        };

        const response = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            ...userData,
            isActive: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create user');
        }
        
        await get().refreshFromServer();
      },

      updateUser: async (id, userData) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        };

        const response = await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(userData)
        });

        if (!response.ok) throw new Error('Update failed');
        await get().refreshFromServer();
      },

      deactivateUser: async (id) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };
        
        const response = await fetch(`${API_URL}/users/${id}/deactivate`, { 
          method: 'POST',
          headers: headers
        });
        
        if (response.ok) await get().refreshFromServer();
      },

      activateUser: async (id) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };
        
        const response = await fetch(`${API_URL}/users/${id}/activate`, { 
          method: 'POST',
          headers: headers
        });
        
        if (response.ok) await get().refreshFromServer();
      },

      resetPassword: async (id, newPassword) => {
  const token = localStorage.getItem('omni_token');
  const response = await fetch(`${API_URL}/users/${id}/reset-password`, {
    method: 'PUT', // Change from POST to PUT
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ newPassword }) // Ensure the key is newPassword
  });

  if (!response.ok) throw new Error('Password reset failed');
},

      addRole: async (roleData) => {
        try {
          const token = localStorage.getItem('omni_token');
          const response = await axios.post(`${API_URL}/roles`, roleData, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          // SANITIZE: Ensure permissions is an array before updating state
          const serverRole = response.data;
          const cleanedRole = {
            ...serverRole,
            permissions: Array.isArray(serverRole.permissions) 
              ? serverRole.permissions 
              : (typeof serverRole.permissions === 'string' ? JSON.parse(serverRole.permissions) : [])
          };
          
          set(state => ({ roles: [...state.roles, cleanedRole] }));
        } catch (error: any) {
          console.error("Store addRole Error:", error.response?.data || error.message);
          throw error; // Re-throw so the UI can show the error toast
        }
      },

      updateRole: async (id: string, roleData: any) => {
        try {
          const token = localStorage.getItem('omni_token');
          const response = await axios.put(`${API_URL}/roles/${id}`, roleData, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          // SANITIZE: Force permissions back into an array
          const serverRole = response.data;
          const sanitizedRole = {
            ...serverRole,
            permissions: Array.isArray(serverRole.permissions) 
              ? serverRole.permissions 
              : (typeof serverRole.permissions === 'string' ? JSON.parse(serverRole.permissions) : [])
          };

          set((state) => ({
            roles: state.roles.map((r) => (r.id === id ? sanitizedRole : r)),
          }));
        } catch (error: any) {
          console.error("Store updateRole Error:", error.response?.data || error.message);
          throw error;
        }
      },

deleteRole: async (id: string) => {
        try {
          const token = localStorage.getItem('omni_token');
          
          // 1. Find the role to check its name before deleting
          const roleToDelete = get().roles.find(r => r.id === id);
          if (roleToDelete?.name.toLowerCase() === 'admin') {
            throw new Error("The System Admin role cannot be deleted.");
          }

          // 2. Send the delete request to the backend
          await axios.delete(`${API_URL}/roles/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          // 3. Update local state only if the server request succeeded
          set((state) => ({
            roles: state.roles.filter((r) => r.id !== id),
          }));


        } catch (error: any) {
          console.error("Store deleteRole Error:", error.response?.data || error.message);
          // Re-throw so the UI can show the "Failed to delete" error box
          throw error;
        }
      },

      // -----------------------------------------------------
      // INVENTORY
      // -----------------------------------------------------

      addProduct: async (productData) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        };

        const response = await fetch(`${API_URL}/products`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(productData)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to add product');
        }
        await get().refreshFromServer();
      },

      updateProduct: async (id, productData) => {
        try {
          const token = localStorage.getItem('omni_token');
          const headers: HeadersInit = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          };
          
          // Data sanitization
          const sanitizedData = {
            ...productData,
            price: Number(productData.price),
            costPrice: Number(productData.costPrice),
            batches: productData.batches?.map((batch: any) => {
              const batchCopy = { ...batch, quantity: Number(batch.quantity) };
              // Clean up temporary local IDs
              if (batch.id && batch.id.toString().includes('.')) {
                delete batchCopy.id;
              }
              return batchCopy;
            })
          };

          const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(sanitizedData)
          });

          if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'Product update failed');
          }

          await get().refreshFromServer();
        } catch (error) {
          console.error("Product Update Error:", error);
          throw error;
        }
      },

      deleteProduct: async (id) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

        const response = await fetch(`${API_URL}/products/${id}`, { 
          method: 'DELETE',
          headers: headers
        });

        if (response.ok) {
          set(state => ({
            products: state.products.filter(p => p.id !== id)
          }));
        }
      },

      deleteBatch: async (productId, batchId) => {
        set(state => ({
          products: state.products.map(p => {
            if (p.id === productId) {
              const remainingBatches = p.batches.filter(b => b.id !== batchId);
              const totalQty = remainingBatches.reduce((sum, b) => sum + b.quantity, 0);
              return { ...p, batches: remainingBatches, quantity: totalQty, stock: totalQty };
            }
            return p;
          })
        }));
      },

      toggleAttendance: async () => {
  const { currentUser, attendance, refreshFromServer } = get();
  if (!currentUser) return;

  try {
    // 1. Find an active session for the current user
    const activeEntry = attendance.find(
      (e) => e.userId === currentUser.id && !e.checkOut
    );

    const now = new Date().toISOString();

    if (activeEntry) {
      // CLOCK OUT: Update the existing entry
      await api.attendance.checkOut(activeEntry.id);
    } else {
      // CLOCK IN: Create a new entry
      await api.attendance.checkIn(currentUser.id);
    }

    // 2. Sync the UI with the latest database state
    await refreshFromServer();
    
  } catch (error) {
    console.error("Attendance Sync Error:", error);
    // Optional: add a toast notification here
  }
},

      // -----------------------------------------------------
      // SALES & BILLING
      // -----------------------------------------------------

      addBill: async (billData: any) => {
        const { products, currentUser, refreshFromServer } = get();
        const settings = useSettingsStore.getState().settings;

        // Auto-assign batches based on FIFO (First Expiry First Out)
        const itemsWithBatches = billData.items?.map((item: any) => {
          const product = products.find((p: any) => p.id === item.productId);
          if (!product || !product.batches) return item;

          const sortedBatches = [...product.batches].sort((a, b) => 
            new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
          );

          let remainingToFill = item.quantity;
          const selectedBatches = [];

          for (const batch of sortedBatches) {
            if (remainingToFill <= 0) break;
            if (batch.quantity <= 0) continue;

            const billedFromThisBatch = Math.min(batch.quantity, remainingToFill);
            selectedBatches.push({
              batchId: batch.id,
              batchNo: batch.batchNo,
              billedQty: billedFromThisBatch
            });
            remainingToFill -= billedFromThisBatch;
          }

          return { ...item, selectedBatches };
        }) || [];

        const resolvedBillType = billData.billType || settings?.defaultBillType || "Normal";
        const isNormalBill = resolvedBillType === "Normal";

        const finalPayload = {
          ...billData,
          items: itemsWithBatches,
          storeName: settings?.storeName || "Omni Inventory Pro",
          storeAddress: settings?.storeAddress || "",
          gstNumber: isNormalBill ? "" : (settings?.gstNumber ? String(settings.gstNumber) : ""),
          billType: resolvedBillType,
          gstPercentage: isNormalBill ? 0 : (billData.gstPercentage ?? settings?.gstPercentage ?? 0),
          totalGst: isNormalBill ? 0 : billData.totalGst,
          taxableAmount: isNormalBill ? 0 : billData.taxableAmount,
          customerId: billData.customerId || null,
          createdBy: currentUser?.id || "admin-001",
          createdAt: new Date().toISOString()
        };

        const token = localStorage.getItem('omni_token');
        const response = await fetch(`${API_URL}/bills`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(finalPayload)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Server rejected the bill');
        }
        
        const savedBill = await response.json();
        await refreshFromServer(); 
        return savedBill;
      },

      cancelBill: async (id) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };
        
        await fetch(`${API_URL}/bills/${id}/cancel`, { 
          method: 'POST',
          headers: headers
        });
        
        set(state => ({
          bills: state.bills.map(b => 
            b.id === id ? { ...b, isCancelled: true, cancelledAt: new Date().toISOString() } : b
          )
        }));
      },

      reinstateBill: async (id) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };
        
        await fetch(`${API_URL}/bills/${id}/reinstate`, { 
          method: 'POST',
          headers: headers
        });
        
        set(state => ({
          bills: state.bills.map(b => b.id === id ? { ...b, isCancelled: false } : b)
        }));
      },

      // -----------------------------------------------------
      // CART & CUSTOMERS
      // -----------------------------------------------------

      addToCart: (item) => set(state => {
        const existingItem = state.cart.find(i => i.productId === item.productId);
        if (existingItem) {
          return {
            cart: state.cart.map(i => 
              i.productId === item.productId 
                ? { ...i, quantity: i.quantity + item.quantity } 
                : i
            )
          };
        }
        return { cart: [...state.cart, item] };
      }),

      removeFromCart: (productId) => set(state => ({
        cart: state.cart.filter(i => i.productId !== productId)
      })),

      updateCartQuantity: (productId, qty) => set(state => ({
        cart: state.cart.map(i => i.productId === productId ? { ...i, quantity: qty } : i)
      })),

      clearCart: () => set({ cart: [] }),

      addCustomer: async (customerData) => {
        const token = localStorage.getItem('omni_token');
        const headers: HeadersInit = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        };

        const response = await fetch(`${API_URL}/customers`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(customerData)
        });
        
        const savedCustomer = await response.json();
        set(state => ({ customers: [...(state.customers ?? []), savedCustomer] }));
        return savedCustomer;
      },

      // -----------------------------------------------------
      // ATTENDANCE & UTILS
      // -----------------------------------------------------

      markAttendance: (userId, status) => set(state => {
        if (userId === 'admin-001') return state; // Skip admin

        const userObj = state.users.find(u => u.id === userId);
        const record: AttendanceRecord = {
          id: generateUUID(),
          userId,
          userName: userObj?.fullName || 'Unknown User',
          date: new Date().toISOString().split('T')[0],
          checkIn: new Date().toISOString(),
          status
        };
        return { attendance: [record, ...(state.attendance ?? [])] };
      }),

      checkOut: (recordId) => set(state => ({
        attendance: state.attendance.map(r => 
          r.id === recordId ? { ...r, checkOut: new Date().toISOString() } : r
        )
      })),

      hasPermission: (perm) => {
  const { currentUser, roles } = get();
  if (!currentUser) return false;
  
  // Handle role as either a plain string or an object { name, permissions }
  const rawRole = currentUser.role as string | { name: string; permissions: string };
  const userRoleName = (typeof rawRole === 'object' && rawRole !== null)
    ? (rawRole.name || '').toLowerCase()
    : String(rawRole).toLowerCase();
  
  // Always allow the Admin user to do everything
  if (userRoleName === 'admin') return true;

  // Check permissions for other roles in the database
  const roleObj = roles.find(r => r.name.toLowerCase() === userRoleName);
  return roleObj ? roleObj.permissions.includes(perm) : false;
},

      getExpiryAlerts: () => {
        const { products } = get();
        const alerts: any[] = [];
        if (!Array.isArray(products)) return [];
        
        const today = new Date();
        products.forEach(product => {
          product.batches?.forEach(batch => {
            if (!batch.expiryDate) return; 
            const expiry = new Date(batch.expiryDate);
            const diffInTime = expiry.getTime() - today.getTime();
            const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24));
            
            if (diffInDays <= 30) {
              alerts.push({ 
                productId: product.id, 
                productName: product.name, 
                batchNo: batch.batchNo, 
                daysRemaining: diffInDays, 
                type: diffInDays <= 0 ? 'EXPIRED' : 'EXPIRING' 
              });
            }
          });
        });
        return alerts;
      },

      startAutoSync: (interval = 30000) => {

      },

      stopAutoSync: () => {

      }
    }),
    {
      name: 'omni-inventory-pro-v2', 
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        // Migration logic for future versions
        return persistedState as AppState;
      },
    }
  )
);
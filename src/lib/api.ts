// src/lib/api.ts
import type { Bill, Product, Customer, User, AppSettings } from './store';

/**
 * Ensures the app connects to the correct port.
 * Electron needs an absolute URL (127.0.0.1) because it doesn't use the Vite proxy.
 */
const getApiBaseUrl = () => {
  const sessionUrl = sessionStorage.getItem('api_base_url');
  if (sessionUrl) return sessionUrl;

  const isElectron = window.navigator.userAgent.toLowerCase().includes('electron') || 
                     window.location.protocol === 'file:';

  if (isElectron) {
    // When loading from file:// the hostname is empty — always use 127.0.0.1
    return `http://127.0.0.1:3001/api`;
  }

  // For Web version: using a relative path works with Vite proxy
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Safely retrieves and parses the auth token.
 */
const getToken = (): string | null => {
  const auth = localStorage.getItem('omni_token'); 
  if (!auth) return null;
  try {
    // Handles both raw strings and JSON-stringified tokens
    return auth.startsWith('"') ? JSON.parse(auth) : auth;
  } catch {
    return auth;
  }
};

const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

/**
 * Central response handler. 
 * Intercepts 401s to manage session state without crashing the app.
 */
const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    // Only clear token if we are NOT on the login page.
    // This prevents the "Login successful but immediate logout" loop.
    const isLoginPage = window.location.pathname.includes('login') || 
                       window.location.hash.includes('login');
                       
    if (!isLoginPage) {

      localStorage.removeItem('omni_token');
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return handleResponse(response);
    },
    me: async () => {
      const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  products: {
    getAll: async () => {
      const response = await fetch(`${getApiBaseUrl()}/products`, { headers: getHeaders() });
      return handleResponse(response);
    },
    getById: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/products/${id}`, { headers: getHeaders() });
      return handleResponse(response);
    },
    create: async (product: Partial<Product>) => {
      const response = await fetch(`${getApiBaseUrl()}/products`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse(response);
    },
    update: async (id: string, product: Partial<Product>) => {
      const response = await fetch(`${getApiBaseUrl()}/products/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/products/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    deleteBatch: async (productId: string, batchId: string) => {
      const response = await fetch(`${getApiBaseUrl()}/products/${productId}/batches/${batchId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  bills: {
    getAll: async () => {
      const response = await fetch(`${getApiBaseUrl()}/bills`, { headers: getHeaders() });
      return handleResponse(response);
    },
    getById: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/bills/${id}`, { headers: getHeaders() });
      return handleResponse(response);
    },
    create: async (billData: any) => {
      const response = await fetch(`${getApiBaseUrl()}/bills`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(billData),
      });
      return handleResponse(response);
    },
    cancel: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/bills/${id}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    reinstate: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/bills/${id}/reinstate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  customers: {
    getAll: async () => {
      const response = await fetch(`${getApiBaseUrl()}/customers`, { headers: getHeaders() });
      return handleResponse(response);
    },
    create: async (customer: Partial<Customer>) => {
      const response = await fetch(`${getApiBaseUrl()}/customers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      });
      return handleResponse(response);
    },
    update: async (id: string, customer: Partial<Customer>) => {
      const response = await fetch(`${getApiBaseUrl()}/customers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/customers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  users: {
    getAll: async () => {
      const response = await fetch(`${getApiBaseUrl()}/users`, { headers: getHeaders() });
      return handleResponse(response);
    },
    create: async (user: Partial<User> & { password: string }) => {
      const response = await fetch(`${getApiBaseUrl()}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(user),
      });
      return handleResponse(response);
    },
    update: async (id: string, user: Partial<User>) => {
      const response = await fetch(`${getApiBaseUrl()}/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(user),
      });
      return handleResponse(response);
    },
    resetPassword: async (id: string, newPassword: string) => {
      const response = await fetch(`${getApiBaseUrl()}/users/${id}/reset-password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${getApiBaseUrl()}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  settings: {
    getAll: async () => {
      const response = await fetch(`${getApiBaseUrl()}/settings`, { headers: getHeaders() });
      return handleResponse(response);
    },
    update: async (settings: Partial<AppSettings>) => {
      const response = await fetch(`${getApiBaseUrl()}/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      return handleResponse(response);
    },
  },

  admin: {
    restartDb: async () => {
      const response = await fetch(`${getApiBaseUrl()}/admin/restart-db`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    resetDb: async () => {
      const response = await fetch(`${getApiBaseUrl()}/admin/reset-db`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  attendance: {
    checkIn: async (userId: string) => {
      const response = await fetch(`${getApiBaseUrl()}/attendance/checkin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
      });
      return handleResponse(response);
    },
    checkOut: async (id: string | number) => {
      const response = await fetch(`${getApiBaseUrl()}/attendance/${id}/checkout`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(response);
    },
  },

  health: async () => {
    const response = await fetch(`${getApiBaseUrl()}/health`);
    return handleResponse(response);
  },
};

export const checkServerConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

export default api;
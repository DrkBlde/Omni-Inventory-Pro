// API client for communicating with backend server
import { Bill, Product, Customer, User, Settings } from './store';

// Allow runtime override of API URL (for LAN access)
const getApiBaseUrl = () => {
  // Check sessionStorage first (set by user for LAN access)
  const sessionUrl = sessionStorage.getItem('api_base_url');
  if (sessionUrl) return sessionUrl;
  // Then check environment variable
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Default to localhost
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Get auth token from localStorage
const getToken = (): string | null => {
  const auth = localStorage.getItem('auth-token');
  return auth ? JSON.parse(auth) : null;
};

const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

// ============ AUTH ============
export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return handleResponse(response);
    },
    me: async () => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // ============ PRODUCTS ============
  products: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    getById: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    create: async (product: Partial<Product>) => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse(response);
    },
    update: async (id: string, product: Partial<Product>) => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    deleteBatch: async (productId: string, batchId: string) => {
      const response = await fetch(`${API_BASE_URL}/products/${productId}/batches/${batchId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // ============ BILLS ============
  bills: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/bills`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    getById: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/bills/${id}`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    create: async (billData: any) => {
      const response = await fetch(`${API_BASE_URL}/bills`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(billData),
      });
      return handleResponse(response);
    },
    cancel: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/bills/${id}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    reinstate: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/bills/${id}/reinstate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // ============ CUSTOMERS ============
  customers: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    create: async (customer: Partial<Customer>) => {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      });
      return handleResponse(response);
    },
    update: async (id: string, customer: Partial<Customer>) => {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // ============ USERS ============
  users: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    create: async (user: Partial<User> & { password: string }) => {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(user),
      });
      return handleResponse(response);
    },
    update: async (id: string, user: Partial<User>) => {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(user),
      });
      return handleResponse(response);
    },
    resetPassword: async (id: string, newPassword: string) => {
      const response = await fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      return handleResponse(response);
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // ============ SETTINGS ============
  settings: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    update: async (settings: Partial<Settings>) => {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      return handleResponse(response);
    },
  },

  // ============ HEALTH CHECK ============
  health: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return handleResponse(response);
  },
};

// Check if server is reachable
export const checkServerConnection = async (): Promise<boolean> => {
  try {
    await api.health();
    return true;
  } catch {
    return false;
  }
};

export default api;

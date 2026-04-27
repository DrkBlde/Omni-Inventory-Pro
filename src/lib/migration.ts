import { useAppStore } from './store';

export async function migrateLocalStorageToDB() {
  const store = useAppStore.getState();
  // token is stored in localStorage as the auth-token key
  const rawToken = localStorage.getItem('auth-token');
  const token: string | null = rawToken ? JSON.parse(rawToken) : null;
  if (!token) return { success: false, error: 'Auth required' };

  const data = {
    products: store.products,
    bills: store.bills,
    settings: store.settings,
    customers: store.customers || []
  };

  try {
    // Use the same dynamic base URL as the rest of the API
    const baseUrl = sessionStorage.getItem('api_base_url') || '/api';
    const response = await fetch(`${baseUrl}/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Request failed' }));
      return { success: false, error: err.message || 'Request failed' };
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

import axios from 'axios';
import { useAppStore } from './store';

export async function migrateLocalStorageToDB() {
  const store = useAppStore.getState();
  const token = store.token;
  if (!token) return { success: false, error: 'Auth required' };

  const data = {
    products: store.products,
    bills: store.bills,
    settings: store.settings,
    customers: store.customers || []
  };

  try {
    const response = await axios.post('http://localhost:3001/api/migrate', data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, data: response.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

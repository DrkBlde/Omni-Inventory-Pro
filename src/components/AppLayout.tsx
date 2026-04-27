import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3, Users, Settings,
  LogOut, Menu, X, Clock, ChevronRight, Receipt, Wifi, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { path: '/inventory', label: 'Inventory', icon: Package, permission: 'inventory.view' },
  { path: '/pos', label: 'POS / Billing', icon: ShoppingCart, permission: 'pos.access' },
  { path: '/bills', label: 'Bill History', icon: Receipt, permission: 'pos.access' },
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
  { path: '/users', label: 'Users & Roles', icon: Users, permission: 'users.view' },
  { path: '/attendance', label: 'Attendance', icon: Clock, permission: 'attendance.view' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localOnline, setLocalOnline] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const { 
    currentUser, 
    logout, 
    roles, 
    isOnline: storeOnline, 
    refreshFromServer,
    startAutoSync, 
    stopAutoSync,
    syncLogout
  } = useAppStore();

  const { refreshFromServer: refreshSettings, settings } = useSettingsStore();

  // 1. Initial Data Fetch and Heartbeat
  useEffect(() => {
    if (currentUser) {
      refreshFromServer();
      refreshSettings();
      startAutoSync(5000); 
    }
    return () => stopAutoSync();
  }, [currentUser, refreshFromServer, refreshSettings, startAutoSync, stopAutoSync]);

  // Auto-checkout when the tab/window is closed
  useEffect(() => {
    const handleUnload = () => syncLogout();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [syncLogout]);

  // Inactivity auto-logout
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMinutes = settings?.inactivityTimeout != null ? settings.inactivityTimeout : 10;

  useEffect(() => {
    if (!currentUser || timeoutMinutes === 0) return;
    if (currentUser.username?.toLowerCase() === 'admin') return;

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(async () => {
        await logout();
        navigate('/');
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer immediately

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser, timeoutMinutes, logout, navigate]);

  // 2. Physical Network Health Check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const online = await api.health();
        setLocalOnline(!!online);
      } catch {
        setLocalOnline(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  // 3. Updated Permission Logic
  // Handles cases where role is an ID string or an object
  const userRoleName = typeof currentUser?.role === 'object' 
    ? currentUser.role.name 
    : currentUser?.role;

  const normalizedUserRole = userRoleName?.toLowerCase() || '';

  // Matches role data by Name or ID to ensure permissions are found
  const roleData = roles?.find(r => 
    r.name?.toLowerCase() === normalizedUserRole || r.id === currentUser?.role
  );

  const hasPermission = useCallback((perm: string | null) => {
    if (!perm || perm === 'dashboard.view') return true;
    if (normalizedUserRole === 'admin') return true;

    if (!roleData || roles.length === 0) {
      if (['cashier', 'manager'].includes(normalizedUserRole)) {
        return ['inventory.view', 'pos.access'].includes(perm);
      }
      return false;
    }

    // Safely parse permissions if they arrived as a string from SQLite
    const permsArray = Array.isArray(roleData.permissions) 
      ? roleData.permissions 
      : (typeof roleData.permissions === 'string' ? JSON.parse(roleData.permissions) : []);

    return permsArray.includes(perm);
  }, [normalizedUserRole, roleData, roles]);

  const filteredNav = navItems.filter(item => hasPermission(item.permission));

  // 4. Async Logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed", err);
      navigate('/');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 glass-strong flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h1 className="text-lg font-bold text-gradient">Omni Inventory</h1>
            <p className="text-xs text-muted-foreground">Pro V2.2.0</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                  active ? "glass text-foreground glow" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="glass-subtle rounded-lg p-3 mb-3">
            <p className="text-sm font-medium truncate">{currentUser?.fullName || 'User'}</p>
            {/* Displays friendly role name instead of ID string */}
            <p className="text-xs text-muted-foreground capitalize">
              {roleData?.name || (typeof currentUser?.role === 'string' ? 'Staff' : currentUser?.role?.name)}
            </p>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass-subtle border-b border-border px-4 py-3 flex items-center justify-between lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="text-sm text-muted-foreground hidden lg:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
              localOnline && storeOnline
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              {localOnline && storeOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{localOnline && storeOnline ? "Online" : "Offline"}</span>
            </div>
            
            <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-xs font-bold border border-white/10">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
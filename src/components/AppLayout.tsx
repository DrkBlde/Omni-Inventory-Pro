import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
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
  { path: '/attendance', label: 'Attendance', icon: Clock, permission: 'reports.view' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, roles, isOnline: storeOnline, startAutoSync, stopAutoSync } = useAppStore();

  // Start auto-sync for real-time updates across all devices
  useEffect(() => {
    // Initial sync on mount
    useAppStore.getState().refreshFromServer();
    // Then sync every 5 seconds
    startAutoSync(5000);
    return () => stopAutoSync();
  }, []);

  // Check server connection periodically
  useEffect(() => {
    const checkConnection = async () => {
      const online = await api.health().catch(() => false);
      setIsOnline(!!online);
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const userRole = roles.find(r => r.name === currentUser?.role);
  const hasPermission = (perm: string | null) => {
    if (!perm) return true;
    if (currentUser?.role === 'Admin') return true;
    return userRole?.permissions.includes(perm) ?? false;
  };

  const filteredNav = navItems.filter(item => hasPermission(item.permission));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
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
            <h1 className="text-lg font-bold text-gradient">OmniInventory</h1>
            <p className="text-xs text-muted-foreground">Pro V2</p>
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
                  active
                    ? "glass text-foreground glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
            <p className="text-sm font-medium truncate">{currentUser?.fullName}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.role}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="glass-subtle border-b border-border px-4 py-3 flex items-center justify-between lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm text-muted-foreground hidden lg:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            {/* Server Connection Status */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
              isOnline || storeOnline
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )} title={isOnline || storeOnline ? "Connected to server" : "Server disconnected"}>
              {isOnline || storeOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isOnline || storeOnline ? "Online" : "Offline"}</span>
            </div>
            <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-xs font-bold">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

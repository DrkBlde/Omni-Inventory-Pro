import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge, getStockStatus } from "@/components/StatusBadge";
import { ServerStatus } from "@/components/ServerStatus";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  AlertCircle,
  Loader2
} from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const Dashboard = () => {
  const { 
    products: rawProducts, 
    bills: rawBills, 
    users: rawUsers, 
    settings, 
    getExpiryAlerts, 
    hasPermission, 
    roles,
    currentUser 
  } = useAppStore();

  // =========================================================
  // DYNAMIC PERMISSION & LOADING LOGIC (FIXED)
  // =========================================================
  
  // Normalize role check (handles 'admin', 'Admin', or ID strings)
  const userRoleStr = typeof currentUser?.role === 'object' ? currentUser.role.name : currentUser?.role;
  const isAdmin = userRoleStr?.toLowerCase() === 'admin';
  
  const rolesLoaded = roles && roles.length > 0;

  // Find current role data to check permissions directly if hasPermission fails
  const currentRoleData = roles?.find(r => 
    r.name?.toLowerCase() === userRoleStr?.toLowerCase() || r.id === currentUser?.role
  );

  // Safely parse permissions
  const permsArray = Array.isArray(currentRoleData?.permissions) 
    ? currentRoleData.permissions 
    : (typeof currentRoleData?.permissions === 'string' ? JSON.parse(currentRoleData.permissions) : []);

  // Final access check
  const canViewDashboard = isAdmin || hasPermission('dashboard.view') || permsArray.includes('dashboard.view');

  // 1. Handle the initial sync state
  if (!rolesLoaded && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Syncing permissions...</p>
      </div>
    );
  }

  // 2. Final Security Guard
  if (!canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          Your role ({userRoleStr || 'Staff'}) does not have permission to view the dashboard.
        </p>
      </div>
    );
  }

  // =========================================================
  // DATA CALCULATIONS
  // =========================================================
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const bills = Array.isArray(rawBills) ? rawBills : [];
  const users = Array.isArray(rawUsers) ? rawUsers : [];

  const totalProducts = products.length;
  
  const productsWithQty = products.map(p => ({
    ...p,
    totalQty: p.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0
  }));

  const lowStockItems = productsWithQty.filter(p => p.totalQty <= (p.lowStockThreshold || 0) && p.totalQty > 0);
  const outOfStock = productsWithQty.filter(p => p.totalQty === 0);
  
  const totalRevenue = bills
    .filter(b => b && !b.isCancelled)
    .reduce((sum, b) => sum + (b.total || 0), 0);

  const todayBills = bills.filter(b => {
    if (!b?.createdAt) return false;
    const d = new Date(b.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString() && !b.isCancelled;
  });

  const todayRevenue = todayBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const activeStaff = users.filter(u => u && u.isActive).length;

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayBills = bills.filter(b => {
      if (!b?.createdAt) return false;
      const bd = new Date(b.createdAt);
      return bd.toDateString() === date.toDateString() && !b.isCancelled;
    });
    return {
      day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      sales: dayBills.reduce((s, b) => s + (b.total || 0), 0),
      orders: dayBills.length,
    };
  });

  const stats = [
    { label: 'Total Products', value: totalProducts, icon: Package, color: 'text-foreground' },
    { label: "Today's Revenue", value: `${settings.currency}${todayRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-success' },
    { label: "Today's Orders", value: todayBills.length, icon: ShoppingCart, color: 'text-foreground' },
    { label: 'Stock Alerts', value: lowStockItems.length + outOfStock.length, icon: AlertTriangle, color: lowStockItems.length + outOfStock.length > 0 ? 'text-warning' : 'text-foreground' },
    { label: 'Total Revenue', value: `${settings.currency}${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-success' },
    { label: 'Active Staff', value: activeStaff, icon: Users, color: 'text-foreground' },
  ];

  const expiryAlerts = getExpiryAlerts() || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your store operations</p>
      </div>

      <ServerStatus />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(stat => (
          <GlassCard key={stat.label} className="p-4">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Expiry Alerts */}
      {expiryAlerts.length > 0 && (
        <GlassCard className="border-l-4 border-red-500/50">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Urgent Expiry Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiryAlerts.slice(0, 6).map((alert: any) => (
              <div 
                key={`${alert.productId}-${alert.batchNo}`} 
                className={`flex items-center justify-between py-2 px-3 rounded-lg border ${
                  alert.type === 'EXPIRED' 
                    ? 'bg-red-500/10 border-red-500/20' 
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${alert.type === 'EXPIRED' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-sm font-medium">{alert.productName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">Batch: {alert.batchNo}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] font-bold ${alert.type === 'EXPIRED' ? 'text-red-500' : 'text-amber-500'}`}>
                    {alert.type === 'EXPIRED' ? 'EXPIRED' : `${alert.daysRemaining} DAYS LEFT`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Sales Chart */}
      <div className="grid lg:grid-cols-1 gap-4">
        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Sales — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0,0%,100%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0,0%,100%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(0,0%,8%)', border: '1px solid hsl(0,0%,16%)', borderRadius: 8, color: 'hsl(0,0%,95%)' }} />
              <Area type="monotone" dataKey="sales" stroke="hsl(0,0%,100%)" fillOpacity={1} fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Stock Alerts */}
      {(lowStockItems.length > 0 || outOfStock.length > 0) && (
        <GlassCard>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Low Stock Alerts
          </h3>
          <div className="space-y-2">
            {[...outOfStock, ...lowStockItems].slice(0, 8).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg glass-subtle">
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{p.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground font-mono bg-white/5 px-1.5 py-0.5 rounded">
                      {p.sku}
                    </p>
                    <p className="text-xs font-bold text-red-400">
                      {p.totalQty} {p.unit}(s) left
                    </p>
                  </div>
                </div>
                <StatusBadge status={getStockStatus(p.totalQty, p.lowStockThreshold, p.veryLowStockThreshold)} />
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default Dashboard;
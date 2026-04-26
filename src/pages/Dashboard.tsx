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
  AlertCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const Dashboard = () => {
  const { products, bills, users, settings, getExpiryAlerts, hasPermission, roles } = useAppStore();

  // Wait for roles to load before checking permissions
  if (!roles || roles.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  // Check if user can view dashboard
  if (!hasPermission('dashboard.view')) {
    return <div className="p-6 text-center text-muted-foreground">Access Denied: Dashboard</div>;
  }

  // 1. Fetch Expiry Alerts
  const expiryAlerts = getExpiryAlerts();

  // Determine which widgets to show based on settings and permissions
  const showStats = hasPermission('dashboard.customize') && settings.dashboardWidgets?.includes('stats') || !hasPermission('dashboard.customize');
  const showCharts = hasPermission('dashboard.customize') && settings.dashboardWidgets?.includes('charts') || !hasPermission('dashboard.customize');
  const showAlerts = hasPermission('dashboard.customize') && settings.dashboardWidgets?.includes('alerts') || !hasPermission('dashboard.customize');

  const totalProducts = products.length;
  const lowStockItems = products.filter(p => p.quantity <= p.lowStockThreshold && p.quantity > 0);
  const outOfStock = products.filter(p => p.quantity === 0);
  const totalRevenue = bills.filter(b => !b.isCancelled).reduce((sum, b) => sum + b.total, 0);
  const todayBills = bills.filter(b => {
    const d = new Date(b.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString() && !b.isCancelled;
  });
  const todayRevenue = todayBills.reduce((sum, b) => sum + b.total, 0);
  const activeStaff = users.filter(u => u.isActive).length;

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayBills = bills.filter(b => {
      const bd = new Date(b.createdAt);
      return bd.toDateString() === date.toDateString() && !b.isCancelled;
    });
    return {
      day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      sales: dayBills.reduce((s, b) => s + b.total, 0),
      orders: dayBills.length,
    };
  });

  const categories = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.quantity;
    return acc;
  }, {} as Record<string, number>);
  const categoryData = Object.entries(categories).map(([name, value]) => ({ name, value }));

  const stats = [
    { label: 'Total Products', value: totalProducts, icon: Package, color: 'text-foreground' },
    { label: "Today's Revenue", value: `${settings.currency}${todayRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-success' },
    { label: "Today's Orders", value: todayBills.length, icon: ShoppingCart, color: 'text-foreground' },
    { label: 'Stock Alerts', value: lowStockItems.length + outOfStock.length, icon: AlertTriangle, color: lowStockItems.length + outOfStock.length > 0 ? 'text-warning' : 'text-foreground' },
    { label: 'Total Revenue', value: `${settings.currency}${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-success' },
    { label: 'Active Staff', value: activeStaff, icon: Users, color: 'text-foreground' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your store operations</p>
      </div>

      {/* Server Status - Desktop App Only (shows IP for web access) */}
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

      {/* 2. Urgent Expiry Alerts Section */}
      {expiryAlerts.length > 0 && (
        <GlassCard className="border-l-4 border-red-500/50">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Urgent Expiry Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiryAlerts.slice(0, 6).map((alert) => (
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

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Sales — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
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

        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(0,0%,8%)', border: '1px solid hsl(0,0%,16%)', borderRadius: 8, color: 'hsl(0,0%,95%)' }} />
              <Bar dataKey="value" fill="hsl(0,0%,60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
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
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku} · {p.quantity} {p.unit}(s) remaining</p>
                </div>
                <StatusBadge status={getStockStatus(p.quantity, p.lowStockThreshold, p.veryLowStockThreshold)} />
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default Dashboard;
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, TrendingUp, Receipt, XCircle, Loader2 } from "lucide-react";

const COLORS = ['hsl(0,0%,100%)', 'hsl(0,0%,70%)', 'hsl(0,0%,50%)', 'hsl(0,0%,35%)', 'hsl(0,0%,20%)'];

const Reports = () => {
  const { bills, products, settings, refreshFromServer } = useAppStore();
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [isHydrated, setIsHydrated] = useState(false);

  // Refresh data on mount
  useEffect(() => {
    refreshFromServer().then(() => setIsHydrated(true)).catch(() => setIsHydrated(true));
  }, []);

  const currency = settings?.currency || '₹';

  // Guard against undefined data during hydration
  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading reports data...</p>
      </div>
    );
  }

  // Handle empty data gracefully
  const billsArray = bills || [];
  const productsArray = products || [];

  const now = new Date();
  const filteredBills = billsArray.filter((b: any) => {
    if (period === 'all') return true;
    const d = new Date(b.createdAt);
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return period === '7d' ? diff <= 7 : diff <= 30;
  });

  const activeBills = filteredBills.filter((b: any) => !b.isCancelled);
  const cancelledBills = filteredBills.filter((b: any) => b.isCancelled);
  const totalRevenue = activeBills.reduce((s: number, b: any) => s + b.total, 0);
  const avgOrderValue = activeBills.length > 0 ? totalRevenue / activeBills.length : 0;

  // Sales over time
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const salesData = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (Math.min(days, 30) - 1 - i));
    const dayBills = activeBills.filter((b: any) => new Date(b.createdAt).toDateString() === date.toDateString());
    return {
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: dayBills.reduce((s: number, b: any) => s + b.total, 0),
      orders: dayBills.length,
    };
  });

  // Top products by revenue
  const productRevenue: Record<string, number> = {};
  activeBills.forEach((b: any) => b.items.forEach((i: any) => {
    productRevenue[i.name] = (productRevenue[i.name] || 0) + i.price * i.quantity;
  }));
  const topProducts = Object.entries(productRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Payment methods breakdown
  const methodTotals: Record<string, number> = {};
  activeBills.forEach((b: any) => b.payments.forEach((p: any) => {
    methodTotals[p.method] = (methodTotals[p.method] || 0) + p.amount;
  }));
  const paymentData = Object.entries(methodTotals).map(([name, value]) => ({ name: name.toUpperCase(), value }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">{activeBills.length} orders in selected period</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', 'all'] as const).map(p => (
            <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <TrendingUp className="w-5 h-5 text-success mb-2" />
          <p className="text-2xl font-bold">{currency}{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </GlassCard>
        <GlassCard className="p-4">
          <Receipt className="w-5 h-5 mb-2" />
          <p className="text-2xl font-bold">{activeBills.length}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </GlassCard>
        <GlassCard className="p-4">
          <Calendar className="w-5 h-5 mb-2" />
          <p className="text-2xl font-bold">{currency}{avgOrderValue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Avg Order Value</p>
        </GlassCard>
        <GlassCard className="p-4">
          <XCircle className="w-5 h-5 text-destructive mb-2" />
          <p className="text-2xl font-bold">{cancelledBills.length}</p>
          <p className="text-xs text-muted-foreground">Cancelled Bills</p>
        </GlassCard>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0,0%,100%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0,0%,100%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(0,0%,8%)', border: '1px solid hsl(0,0%,16%)', borderRadius: 8, color: '#ffffff' }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(0,0%,100%)" fillOpacity={1} fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Payment Methods</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                {paymentData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'hsl(0,0%,8%)', border: '1px solid hsl(0,0%,16%)', borderRadius: 8, color: '#ffffff' }} 
                itemStyle={{ color: '#ffffff' }}
                labelStyle={{ color: '#ffffff' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {paymentData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name}: {currency}{d.value.toLocaleString()}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Top Products */}
      <GlassCard>
        <h3 className="text-sm font-semibold mb-4">Top Products by Revenue</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.map((p, i) => (
              <TableRow key={p.name} className="border-border">
                <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right font-mono">{currency}{p.value.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {topProducts.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No sales data yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Recent Bills */}
      <GlassCard>
        <h3 className="text-sm font-semibold mb-4">Recent Bills</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="hidden md:table-cell">Cashier</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBills.slice(-20).reverse().map(b => (
              <TableRow key={b.id} className="border-border">
                <TableCell className="font-mono">#{b.billNumber}</TableCell>
                <TableCell className="text-sm">{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{b.items.length}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{b.createdByName}</TableCell>
                <TableCell className="text-right font-mono">{currency}{b.total}</TableCell>
                <TableCell>
                  {b.isCancelled ? (
                    <span className="text-xs text-destructive">Cancelled</span>
                  ) : (
                    <span className="text-xs text-success">Completed</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredBills.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No bills yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
};

export default Reports;

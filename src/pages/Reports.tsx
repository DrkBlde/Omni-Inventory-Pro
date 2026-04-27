import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, TrendingUp, Receipt, XCircle, Loader2, DollarSign } from "lucide-react";

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
  
  // KPI Calculations
  const totalRevenue = activeBills.reduce((s: number, b: any) => s + b.total, 0);
  const avgOrderValue = activeBills.length > 0 ? totalRevenue / activeBills.length : 0;

  // Profit Calculation
  const totalCost = activeBills.reduce((acc: number, bill: any) => {
    const billCost = bill.items.reduce((itemAcc: number, item: any) => {
      const product = productsArray.find((p: any) => p.id === item.productId);
      const costPrice = product?.buyingPrice || product?.costPrice || 0;
      return itemAcc + (costPrice * item.quantity);
    }, 0);
    return acc + billCost;
  }, 0);

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

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
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
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

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard className="p-4">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{currency}{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </GlassCard>

        <GlassCard className="p-4">
          <DollarSign className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold text-emerald-500">{currency}{totalProfit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Net Profit ({profitMargin.toFixed(1)}%)</p>
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

      <div className="grid lg:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-6">Revenue Trend</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-6">Payment Methods</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} 
                  itemStyle={{ color: 'white' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {paymentData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1 text-[10px] uppercase font-bold">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name}: {currency}{d.value.toLocaleString()}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h3 className="text-sm font-semibold mb-4">Top Products by Revenue</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.map((p, i) => (
              <TableRow key={p.name} className="border-border">
                <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">{currency}{p.value.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {topProducts.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No sales data yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="text-sm font-semibold mb-4">Recent Transactions (Last 10)</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Bill #</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="hidden md:table-cell">Cashier</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...filteredBills]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 10)
              .map(b => (
                <TableRow key={b.id} className="border-border">
                  <TableCell className="font-mono font-bold">#{b.billNumber}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(b.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{b.items.length} items</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{b.createdByName}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{currency}{b.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${b.isCancelled ? 'text-red-500 bg-red-500/10' : 'text-green-500 bg-green-500/10'}`}>
                      {b.isCancelled ? 'Cancelled' : 'Completed'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
};

export default Reports;
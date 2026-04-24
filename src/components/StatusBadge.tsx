import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'in-stock' | 'low' | 'very-low' | 'out-of-stock';
}

const config = {
  'in-stock': { label: 'In Stock', classes: 'bg-success/20 text-success border-success/30' },
  'low': { label: 'Low Stock', classes: 'bg-warning/20 text-warning border-warning/30' },
  'very-low': { label: 'Very Low', classes: 'bg-destructive/20 text-destructive border-destructive/30' },
  'out-of-stock': { label: 'Out of Stock', classes: 'bg-muted text-muted-foreground border-muted' },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", c.classes)}>
      {c.label}
    </span>
  );
};

export const getStockStatus = (qty: number, low: number, veryLow: number): StatusBadgeProps['status'] => {
  if (qty === 0) return 'out-of-stock';
  if (qty <= veryLow) return 'very-low';
  if (qty <= low) return 'low';
  return 'in-stock';
};

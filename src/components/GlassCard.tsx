import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'strong';
}

export const GlassCard = ({ children, className, variant = 'default', ...props }: GlassCardProps) => {
  const variantClass = variant === 'subtle' ? 'glass-subtle' : variant === 'strong' ? 'glass-strong' : 'glass';
  return (
    <div className={cn(variantClass, "rounded-lg p-6 bg-white/5", className)} {...props}>
      {children}
    </div>
  );
};

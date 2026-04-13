import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from './card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  change?: { value: number; type: 'up' | 'down' };
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  change,
  subtitle,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold">{value}</p>
            {change && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  change.type === 'up' ? 'text-[#0ab39c]' : 'text-[#f06548]'
                }`}
              >
                {change.type === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {change.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

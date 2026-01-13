import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Home, TrendingUp } from 'lucide-react';

interface PropertyPerformanceChartProps {
  data: {
    id: string;
    name: string;
    revenue: number;
    status: string;
  }[];
}

export function PropertyPerformanceChart({ data }: PropertyPerformanceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'occupied':
        return {
          color: 'hsl(160 60% 45%)',
          colorLight: 'hsl(160 60% 55%)',
          glow: 'hsl(160 60% 45% / 0.3)',
          label: 'Occupied',
          bg: 'from-emerald-500/5 to-transparent',
        };
      case 'available':
        return {
          color: 'hsl(38 92% 50%)',
          colorLight: 'hsl(38 92% 60%)',
          glow: 'hsl(38 92% 50% / 0.3)',
          label: 'Available',
          bg: 'from-amber-500/5 to-transparent',
        };
      case 'off_market':
        return {
          color: 'hsl(215 16% 47%)',
          colorLight: 'hsl(215 16% 57%)',
          glow: 'hsl(215 16% 47% / 0.3)',
          label: 'Off Market',
          bg: 'from-slate-500/5 to-transparent',
        };
      default:
        return {
          color: 'hsl(var(--muted-foreground))',
          colorLight: 'hsl(var(--muted-foreground))',
          glow: 'hsl(var(--muted-foreground) / 0.3)',
          label: status,
          bg: 'from-muted/5 to-transparent',
        };
    }
  };

  // Limit to top 6 properties and calculate max revenue for relative widths
  const topProperties = data.slice(0, 6);
  const maxRevenue = Math.max(...topProperties.map(p => p.revenue), 1);

  if (data.length === 0) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
        <CardHeader>
          <CardTitle className="text-xl font-serif flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Property Performance
          </CardTitle>
          <p className="text-sm text-muted-foreground">Revenue by property</p>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No properties available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-border/30 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/20 transition-all duration-300">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-serif flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Property Performance
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Revenue by property (top 6)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        {topProperties.map((property, index) => {
          const config = getStatusConfig(property.status);
          const percentage = maxRevenue > 0 ? (property.revenue / maxRevenue) * 100 : 0;
          const hasRevenue = property.revenue > 0;

          return (
            <div
              key={property.id}
              className={`group/item p-4 rounded-xl bg-gradient-to-r ${config.bg} hover:bg-muted/30 transition-all duration-300 border border-border/20 hover:border-border/40 hover:shadow-lg`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Row 1: Property name and status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-1.5 rounded-lg bg-muted/50">
                    <Home className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-sm truncate text-foreground/90">
                    {property.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {config.label}
                  </span>
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: config.color,
                      boxShadow: `0 0 8px ${config.glow}, 0 0 0 2px ${config.color}30`,
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Progress bar + Amount */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  {hasRevenue ? (
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(percentage, 3)}%`,
                        background: `linear-gradient(90deg, ${config.color}, ${config.colorLight})`,
                        boxShadow: `0 0 12px ${config.glow}`,
                      }}
                    />
                  ) : (
                    <div
                      className="h-full w-full rounded-full opacity-30"
                      style={{
                        background: `repeating-linear-gradient(90deg, ${config.color} 0px, ${config.color} 4px, transparent 4px, transparent 8px)`,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`text-base font-bold tabular-nums min-w-[90px] text-right ${
                    hasRevenue ? 'text-foreground' : 'text-muted-foreground text-sm font-medium'
                  }`}
                >
                  {hasRevenue ? formatCurrency(property.revenue) : 'No revenue'}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

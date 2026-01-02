import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2 } from 'lucide-react';

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const statusColor = getBarColor(item.status);
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-4">
          <p className="text-sm font-medium text-foreground truncate max-w-[200px] mb-1">{item.name}</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(item.revenue)}</p>
          <div className="flex items-center gap-2 mt-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: statusColor }}
            />
            <p className="text-xs text-muted-foreground capitalize">{item.status.replace('_', ' ')}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Truncate long property names
  const chartData = data.map(item => ({
    ...item,
    shortName: item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name,
  }));

  const getBarColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'hsl(160 45% 45%)'; // Teal
      case 'available':
        return 'hsl(35 80% 55%)'; // Amber
      case 'off_market':
        return 'hsl(0 60% 55%)'; // Rose
      default:
        return 'hsl(var(--muted-foreground))';
    }
  };

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
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No payment data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-teal-500/10 bg-gradient-to-br from-card via-card to-teal-500/5 hover:border-teal-500/20 transition-all duration-300">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-serif flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-500" />
              Property Performance
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Revenue by property (top 8)</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[hsl(160_45%_45%)]" />
              <span className="text-muted-foreground">Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[hsl(35_80%_55%)]" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[hsl(0_60%_55%)]" />
              <span className="text-muted-foreground">Off Market</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.3}
                horizontal={false} 
              />
              <XAxis 
                type="number"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                dataKey="shortName"
                type="category"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
              <Bar 
                dataKey="revenue" 
                radius={[0, 6, 6, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.status)}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

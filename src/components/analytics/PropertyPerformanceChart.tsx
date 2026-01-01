import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{item.name}</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(item.revenue)}</p>
          <p className="text-xs text-muted-foreground capitalize">{item.status}</p>
        </div>
      );
    }
    return null;
  };

  // Truncate long property names
  const chartData = data.map(item => ({
    ...item,
    shortName: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
  }));

  const getBarColor = (status: string) => {
    switch (status) {
      case 'occupied':
        return 'hsl(var(--chart-1))';
      case 'available':
        return 'hsl(var(--chart-2))';
      default:
        return 'hsl(var(--chart-3))';
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Property Performance</CardTitle>
          <p className="text-sm text-muted-foreground">Revenue by property</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No payment data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif">Property Performance</CardTitle>
        <p className="text-sm text-muted-foreground">Revenue by property (top 8)</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
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
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

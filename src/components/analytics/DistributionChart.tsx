import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface DistributionChartProps {
  title: string;
  data: {
    name: string;
    value: number;
    color: string;
  }[];
}

// High-contrast color mapping for better visibility
const getStatusColor = (name: string, originalColor: string): string => {
  const colorMap: Record<string, string> = {
    // Property statuses
    'Occupied': '#10b981', // Emerald
    'Available': '#f59e0b', // Amber
    'Off Market': '#64748b', // Slate
    // Lease statuses
    'Active': '#10b981', // Emerald
    'Completed': '#10b981', // Emerald
    'Pending Tenant': '#f59e0b', // Amber
    'Pending Manager': '#f59e0b', // Amber
    'Draft': '#64748b', // Slate
    'Expired': '#f43f5e', // Rose
  };
  
  return colorMap[name] || originalColor;
};

export function DistributionChart({ title, data }: DistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Enhanced data with high-contrast colors
  const enhancedData = data.map(item => ({
    ...item,
    color: getStatusColor(item.name, item.color),
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));

  return (
    <Card className="group relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/20 transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        {/* Stacked horizontal bar */}
        <div className="h-4 rounded-full overflow-hidden bg-muted/50 flex">
          {enhancedData.map((item, index) => (
            <div
              key={index}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ 
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.name}: ${item.value} (${item.percentage.toFixed(0)}%)`}
            />
          ))}
        </div>

        {/* Legend with progress bars */}
        <div className="space-y-3">
          {enhancedData.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              {/* Color dot */}
              <div 
                className="w-3 h-3 rounded-full shrink-0 shadow-sm ring-2 ring-background"
                style={{ backgroundColor: item.color }}
              />
              
              {/* Name and progress bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2 shrink-0">
                    {item.value} <span className="text-xs">({item.percentage.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ 
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

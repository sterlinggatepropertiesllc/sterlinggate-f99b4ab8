import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface DistributionChartProps {
  title: string;
  data: {
    name: string;
    value: number;
    color: string;
  }[];
}

export function DistributionChart({ title, data }: DistributionChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: payload[0].payload.color }}
            />
            <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: payload[0].payload.color }}>
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        className="text-xs font-semibold drop-shadow-md"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <PieChartIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/20 transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <filter key={`shadow-${index}`} id={`shadow-${index}`}>
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={entry.color} floodOpacity="0.3"/>
                  </filter>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={75}
                innerRadius={40}
                dataKey="value"
                strokeWidth={3}
                stroke="hsl(var(--background))"
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="transition-all duration-300 hover:opacity-80"
                    style={{ filter: `url(#shadow-${index})` }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium text-foreground">({entry.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

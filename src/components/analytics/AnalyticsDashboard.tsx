import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Home, 
  Users, 
  Percent,
  Building2,
  FileText,
  Sparkles
} from 'lucide-react';
import { RevenueChart } from './RevenueChart';
import { PropertyPerformanceChart } from './PropertyPerformanceChart';
import { DistributionChart } from './DistributionChart';

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const analytics = useAnalytics(user?.id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
              Portfolio Analytics
            </h1>
            <p className="text-muted-foreground">Real-time insights into your property performance</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent mt-4" />
      </div>

      {/* Key Metrics - Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Monthly Revenue Card */}
        <Card className="group relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-500 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(analytics.currentMonthRevenue)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                analytics.revenueChange >= 0 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {analytics.revenueChange >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {formatPercent(Math.abs(analytics.revenueChange))}
              </div>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate Card */}
        <Card className="group relative overflow-hidden border-teal-500/10 bg-gradient-to-br from-card via-card to-teal-500/5 hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-500 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-teal-500/10 transition-colors duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy Rate</CardTitle>
            <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
              <Home className="h-4 w-4 text-teal-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold tracking-tight">{formatPercent(analytics.occupancyRate)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-1000"
                  style={{ width: `${analytics.occupancyRate}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {analytics.occupiedProperties}/{analytics.totalProperties}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate Card */}
        <Card className="group relative overflow-hidden border-amber-500/10 bg-gradient-to-br from-card via-card to-amber-500/5 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-500 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-colors duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <Percent className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold tracking-tight">{formatPercent(analytics.collectionRate)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatCurrency(analytics.currentMonthRevenue)} of {formatCurrency(analytics.expectedMonthlyRent)}
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue Card */}
        <Card className="group relative overflow-hidden border-violet-500/10 bg-gradient-to-br from-card via-card to-violet-500/5 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-500 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-violet-500/10 transition-colors duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="p-2 rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
              <DollarSign className="h-4 w-4 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold tracking-tight">{formatCurrency(analytics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-2">All time earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Full Width Revenue Chart */}
      <div className="animate-fade-in" style={{ animationDelay: '500ms' }}>
        <RevenueChart data={analytics.monthlyRevenue} />
      </div>

      {/* Full Width Property Performance */}
      <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
        <PropertyPerformanceChart data={analytics.revenueByProperty.slice(0, 8)} />
      </div>

      {/* Quick Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '700ms' }}>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-card to-primary/5 border border-primary/10">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{analytics.totalProperties}</p>
            <p className="text-xs text-muted-foreground">Properties</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-card to-teal-500/5 border border-teal-500/10">
          <div className="p-2.5 rounded-lg bg-teal-500/10">
            <Users className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{analytics.activeTenants}</p>
            <p className="text-xs text-muted-foreground">Active Tenants</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-card to-amber-500/5 border border-amber-500/10">
          <div className="p-2.5 rounded-lg bg-amber-500/10">
            <FileText className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{analytics.activeLeases}</p>
            <p className="text-xs text-muted-foreground">Active Leases</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-card to-emerald-500/5 border border-emerald-500/10">
          <div className="p-2.5 rounded-lg bg-emerald-500/10">
            <Home className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{analytics.availableProperties}</p>
            <p className="text-xs text-muted-foreground">Available Units</p>
          </div>
        </div>
      </div>

      {/* Distribution Charts - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: '800ms' }}>
        <DistributionChart 
          title="Property Status" 
          data={analytics.propertyStatusDistribution} 
        />
        <DistributionChart 
          title="Lease Status" 
          data={analytics.leaseStatusDistribution} 
        />
      </div>
    </div>
  );
}

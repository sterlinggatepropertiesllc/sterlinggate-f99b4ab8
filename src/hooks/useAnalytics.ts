import { useMemo } from 'react';
import { useManagerProperties } from './useProperties';
import { useTenants } from './useTenants';
import { useLeases } from './useLeases';
import { useAllPayments } from './usePayments';
import { useApplications } from './useApplications';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, isWithinInterval } from 'date-fns';

export function useAnalytics(managerId: string | undefined) {
  const { data: properties = [] } = useManagerProperties(managerId);
  const { data: tenants = [] } = useTenants(managerId);
  const { data: leases = [] } = useLeases(managerId, 'property_manager');
  const { data: payments = [] } = useAllPayments();
  const { data: applications = [] } = useApplications();

  const analytics = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Calculate current month revenue
    const currentMonthRevenue = payments
      .filter(p => {
        const paymentDate = parseISO(p.payment_date);
        return isWithinInterval(paymentDate, { start: currentMonthStart, end: currentMonthEnd });
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate last month revenue
    const lastMonthRevenue = payments
      .filter(p => {
        const paymentDate = parseISO(p.payment_date);
        return isWithinInterval(paymentDate, { start: lastMonthStart, end: lastMonthEnd });
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Revenue change percentage
    const revenueChange = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Occupancy rate
    const totalProperties = properties.length;
    const occupiedProperties = properties.filter(p => p.status === 'occupied').length;
    const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

    // Active leases
    const activeLeases = leases.filter(l => l.status === 'completed').length;
    const pendingLeases = leases.filter(l => 
      l.status === 'pending_tenant_signature' || l.status === 'pending_manager_signature'
    ).length;

    // Active tenants
    const activeTenants = tenants.filter(t => t.is_active).length;

    // Pending applications
    const pendingApplications = applications.filter(a => 
      a.status === 'pending' || a.status === 'under_review'
    ).length;

    // Monthly revenue for the past 12 months
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const monthStart = startOfMonth(subMonths(now, 11 - i));
      const monthEnd = endOfMonth(subMonths(now, 11 - i));
      
      const revenue = payments
        .filter(p => {
          const paymentDate = parseISO(p.payment_date);
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        month: format(monthStart, 'MMM'),
        revenue,
        fullDate: format(monthStart, 'MMMM yyyy'),
      };
    });

    // Revenue by property
    const revenueByProperty = properties.map(property => {
      const propertyPayments = payments.filter(p => p.property_id === property.id);
      const totalRevenue = propertyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        id: property.id,
        name: `${property.address}, ${property.city}`,
        revenue: totalRevenue,
        status: property.status,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Property status distribution
    const propertyStatusDistribution = [
      { name: 'Available', value: properties.filter(p => p.status === 'available').length, color: 'hsl(var(--chart-1))' },
      { name: 'Occupied', value: properties.filter(p => p.status === 'occupied').length, color: 'hsl(var(--chart-2))' },
      { name: 'Off Market', value: properties.filter(p => p.status === 'off_market').length, color: 'hsl(var(--chart-3))' },
    ].filter(item => item.value > 0);

    // Lease status distribution
    const leaseStatusDistribution = [
      { name: 'Active', value: leases.filter(l => l.status === 'completed').length, color: 'hsl(var(--chart-1))' },
      { name: 'Pending', value: leases.filter(l => l.status.includes('pending')).length, color: 'hsl(var(--chart-2))' },
      { name: 'Draft', value: leases.filter(l => l.status === 'draft').length, color: 'hsl(var(--chart-3))' },
      { name: 'Expired', value: leases.filter(l => l.status === 'expired').length, color: 'hsl(var(--chart-4))' },
    ].filter(item => item.value > 0);

    // Total revenue all time
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Expected monthly rent (from active leases)
    const expectedMonthlyRent = leases
      .filter(l => l.status === 'completed')
      .reduce((sum, l) => sum + Number(l.monthly_rent), 0);

    // Collection rate for current month
    const collectionRate = expectedMonthlyRent > 0 
      ? Math.min((currentMonthRevenue / expectedMonthlyRent) * 100, 100) 
      : 0;

    return {
      currentMonthRevenue,
      lastMonthRevenue,
      revenueChange,
      totalRevenue,
      occupancyRate,
      collectionRate,
      expectedMonthlyRent,
      totalProperties,
      occupiedProperties,
      availableProperties: properties.filter(p => p.status === 'available').length,
      activeLeases,
      pendingLeases,
      activeTenants,
      pendingApplications,
      monthlyRevenue,
      revenueByProperty,
      propertyStatusDistribution,
      leaseStatusDistribution,
    };
  }, [properties, tenants, leases, payments, applications]);

  return analytics;
}

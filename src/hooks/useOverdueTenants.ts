import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface OverdueTenant {
  id: string;
  name: string;
  email: string;
  propertyAddress: string | null;
  amountOwed: number;
  daysOverdue: number;
  rentDueDay: number;
}

export function useOverdueTenants(managerId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['overdue-tenants', managerId],
    queryFn: async () => {
      if (!managerId) return [];

      // Get all active tenants for this manager with positive balance
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          id,
          user_id,
          property_id,
          current_balance,
          lease_start_date,
          rent_amount
        `)
        .eq('manager_id', managerId)
        .eq('is_active', true)
        .gt('current_balance', 0);

      if (error) throw error;

      // For each tenant with a balance, check if they have an active lease and get details
      const overdueTenants: OverdueTenant[] = [];

      for (const tenant of tenants || []) {
        // Get profile info
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', tenant.user_id)
          .single();

        // Get property info if assigned
        let propertyAddress: string | null = null;
        if (tenant.property_id) {
          const { data: property } = await supabase
            .from('properties')
            .select('address')
            .eq('id', tenant.property_id)
            .single();
          propertyAddress = property?.address || null;
        }

        // Get active lease for rent due day
        const { data: lease } = await supabase
          .from('leases')
          .select('rent_due_day, grace_period_days')
          .eq('tenant_id', tenant.user_id)
          .in('status', ['completed', 'pending_manager_signature', 'pending_tenant_signature'])
          .gte('end_date', new Date().toISOString().split('T')[0])
          .lte('start_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const rentDueDay = lease?.rent_due_day || 1;
        const gracePeriod = lease?.grace_period_days || 5;

        // Calculate days overdue
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Due date for current month
        let dueDate = new Date(currentYear, currentMonth, rentDueDay);
        
        // If we're before the due date this month, check last month's due date
        if (today < dueDate) {
          dueDate = new Date(currentYear, currentMonth - 1, rentDueDay);
        }

        // Add grace period
        const gracePeriodEnd = new Date(dueDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);

        // Calculate days overdue (only if past grace period)
        const daysOverdue = today > gracePeriodEnd 
          ? Math.floor((today.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Only include if actually overdue (past grace period)
        if (daysOverdue > 0) {
          overdueTenants.push({
            id: tenant.id,
            name: profile?.full_name || 'Unknown Tenant',
            email: profile?.email || '',
            propertyAddress,
            amountOwed: tenant.current_balance || 0,
            daysOverdue,
            rentDueDay,
          });
        }
      }

      // Sort by days overdue (most overdue first)
      return overdueTenants.sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
    enabled: !!managerId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!managerId) return;

    const channel = supabase
      .channel('overdue-tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['overdue-tenants', managerId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'balance_adjustments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['overdue-tenants', managerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [managerId, queryClient]);

  return {
    overdueTenants: query.data || [],
    isLoading: query.isLoading,
    count: query.data?.length || 0,
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";

export interface OverdueTenant {
  id: string;
  name: string;
  email: string;
  propertyAddress: string | null;
  amountOwed: number;
  daysOverdue: number;
  rentDueDay: number;
}

const STORAGE_KEY = 'overdue-alerts-dismissed';

function getDismissedMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissedMap(map: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useOverdueTenants(managerId: string | undefined) {
  const queryClient = useQueryClient();
  const [dismissedMap, setDismissedMap] = useState<Record<string, number>>(getDismissedMap);

  const query = useQuery({
    queryKey: ['overdue-tenants', managerId],
    queryFn: async () => {
      if (!managerId) return [];

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

      const overdueTenants: OverdueTenant[] = [];

      for (const tenant of tenants || []) {
        // Fetch pending ACH payments for this tenant to compute effective balance
        const { data: pendingPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('tenant_id', tenant.id)
          .eq('status', 'processing')
          .eq('payment_method_type', 'ach');

        const totalPendingACH = (pendingPayments || []).reduce((sum, p) => sum + p.amount, 0);
        const effectiveBalance = (tenant.current_balance || 0) - totalPendingACH;

        // Skip if effective balance is zero or negative (pending ACH covers the balance)
        if (effectiveBalance <= 0) continue;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', tenant.user_id)
          .single();

        let propertyAddress: string | null = null;
        if (tenant.property_id) {
          const { data: property } = await supabase
            .from('properties')
            .select('address')
            .eq('id', tenant.property_id)
            .single();
          propertyAddress = property?.address || null;
        }

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

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        let dueDate = new Date(currentYear, currentMonth, rentDueDay);
        
        if (today < dueDate) {
          dueDate = new Date(currentYear, currentMonth - 1, rentDueDay);
        }

        const gracePeriodEnd = new Date(dueDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);

        const daysOverdue = today > gracePeriodEnd 
          ? Math.floor((today.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (daysOverdue > 0) {
          overdueTenants.push({
            id: tenant.id,
            name: profile?.full_name || 'Unknown Tenant',
            email: profile?.email || '',
            propertyAddress,
            amountOwed: effectiveBalance,
            daysOverdue,
            rentDueDay,
          });
        }
      }

      return overdueTenants.sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
    enabled: !!managerId,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!managerId) return;

    const channel = supabase
      .channel('overdue-tenants-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => {
        queryClient.invalidateQueries({ queryKey: ['overdue-tenants', managerId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balance_adjustments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['overdue-tenants', managerId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['overdue-tenants', managerId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [managerId, queryClient]);

  const activeOverdueTenants = useMemo(() => {
    const all = query.data || [];
    return all.filter((t) => {
      if (!(t.id in dismissedMap)) return true;
      return dismissedMap[t.id] !== t.amountOwed;
    });
  }, [query.data, dismissedMap]);

  const dismissAlert = useCallback((tenantId: string, amount: number) => {
    setDismissedMap((prev) => {
      const next = { ...prev, [tenantId]: amount };
      saveDismissedMap(next);
      return next;
    });
  }, []);

  const clearAllAlerts = useCallback(() => {
    const all = query.data || [];
    const next: Record<string, number> = { ...dismissedMap };
    all.forEach((t) => { next[t.id] = t.amountOwed; });
    saveDismissedMap(next);
    setDismissedMap(next);
  }, [query.data, dismissedMap]);

  return {
    overdueTenants: activeOverdueTenants,
    allOverdueTenants: query.data || [],
    isLoading: query.isLoading,
    count: activeOverdueTenants.length,
    dismissAlert,
    clearAllAlerts,
  };
}
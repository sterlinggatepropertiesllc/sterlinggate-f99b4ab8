import type { Tables } from '@/integrations/supabase/types';

export type AdminDashboardTab =
  | 'overview'
  | 'properties'
  | 'applications'
  | 'tenants'
  | 'leases'
  | 'messages'
  | 'inquiries'
  | 'analytics'
  | 'audit'
  | 'maintenance';

export type PaymentControlFilter =
  | 'all'
  | 'completed'
  | 'processing-ach'
  | 'needs-review'
  | 'failed';

export type TenantHealthFilter =
  | 'all'
  | 'balance-due'
  | 'pending-ach'
  | 'unassigned'
  | 'paid-up';

export interface AdminNavigationOptions {
  paymentFilter?: PaymentControlFilter;
  tenantFilter?: TenantHealthFilter;
}

export type AdminNavigate = (
  tab: AdminDashboardTab,
  options?: AdminNavigationOptions
) => void;

export type PropertyRecord = Tables<'properties'>;

export interface ProfileSummary {
  id: string;
  email: string | null;
  full_name: string | null;
  phone?: string | null;
}

export interface PropertySummary {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  rent_amount?: number | null;
  manager_id?: string | null;
}

export interface TenantRecord extends Tables<'tenants'> {
  user?: ProfileSummary | null;
  primary_property?: PropertySummary | null;
  property?: PropertySummary | null;
  primary_rent_amount?: number | null;
  primary_lease_start?: string | null;
  primary_lease_end?: string | null;
  additional_properties_count?: number | null;
}

export interface ApplicationRecord extends Tables<'applications'> {
  properties?: PropertySummary | null;
  profiles?: ProfileSummary | null;
}

export interface LeaseRecord extends Tables<'leases'> {
  properties?: PropertySummary | null;
  tenant?: Pick<ProfileSummary, 'id' | 'email' | 'full_name'> | null;
  manager?: Pick<ProfileSummary, 'id' | 'email' | 'full_name'> | null;
  signatures?: Array<{
    id: string;
    signer_id: string;
    signed_at: string;
    hash_id: string;
    signature_data?: string;
    signature_type?: string;
    ip_address?: string | null;
  }>;
}

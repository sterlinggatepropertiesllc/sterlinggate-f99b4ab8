import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type RentAction =
  | 'charge_rent'
  | 'apply_late_fee'
  | 'waive_late_fee'
  | 'process_all_rent'
  | 'process_all_late_fees';

interface RentActionRequest {
  action: RentAction;
  tenant_id?: string;
  rent_charge_id?: string;
  rent_period?: string;
  override_amount?: number;
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const systemActions = new Set<RentAction>(['process_all_rent', 'process_all_late_fees']);

function jsonResponse(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    }
  );
}

function requireCronSecret(req: Request) {
  const expectedSecret = Deno.env.get('RENT_CRON_SECRET');
  if (!expectedSecret) {
    throw new HttpError('RENT_CRON_SECRET not configured', 500);
  }

  const providedSecret = req.headers.get('x-cron-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new HttpError('Unauthorized cron request', 401);
  }
}

async function requirePropertyManager(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError('No authorization header provided', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw new HttpError('Not authenticated', 401);
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'property_manager')
    .maybeSingle();

  if (roleError || !roleData) {
    throw new HttpError('Only property managers can run this action', 403);
  }

  return userData.user.id;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError('Method not allowed', 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { action, tenant_id, rent_charge_id, rent_period, override_amount }: RentActionRequest = await req.json();
    if (!action) {
      throw new HttpError('action is required');
    }

    const managerId = systemActions.has(action)
      ? (requireCronSecret(req), null)
      : await requirePropertyManager(req, supabase);
    
    console.log(`Processing rent action: ${action}`, { tenant_id, rent_charge_id, rent_period });

    let result;

    switch (action) {
      case 'charge_rent': {
        // Charge rent for a specific tenant
        if (!tenant_id) {
          throw new Error('tenant_id is required for charge_rent action');
        }
        
        const { data, error } = await supabase.rpc('charge_tenant_rent', {
          _tenant_id: tenant_id,
          _rent_period: rent_period || null,
          _created_by: managerId,
        });
        
        if (error) throw error;
        result = data;
        console.log('Rent charged successfully:', result);
        break;
      }

      case 'apply_late_fee': {
        // Apply late fee to a specific rent charge
        if (!rent_charge_id) {
          throw new Error('rent_charge_id is required for apply_late_fee action');
        }
        
        const { data, error } = await supabase.rpc('apply_rent_late_fee', {
          _rent_charge_id: rent_charge_id,
          _created_by: managerId,
          _override_amount: override_amount || null,
        });
        
        if (error) throw error;
        result = data;
        console.log('Late fee applied successfully:', result);
        break;
      }

      case 'waive_late_fee': {
        // Waive late fee for a specific rent charge
        if (!rent_charge_id) {
          throw new Error('rent_charge_id is required for waive_late_fee action');
        }
        
        const { data, error } = await supabase.rpc('waive_rent_late_fee', {
          _rent_charge_id: rent_charge_id,
          _waived_by: managerId,
        });
        
        if (error) throw error;
        result = data;
        console.log('Late fee waived successfully:', result);
        break;
      }

      case 'process_all_rent': {
        // Process monthly rent for all active tenants with auto_charge_rent enabled
        const { data, error } = await supabase.rpc('process_monthly_rent');
        
        if (error) throw error;
        result = data;
        console.log('Monthly rent processed:', result);
        break;
      }

      case 'process_all_late_fees': {
        // Process late fees for all overdue rent charges
        const { data, error } = await supabase.rpc('process_late_fees');
        
        if (error) throw error;
        result = data;
        console.log('Late fees processed:', result);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: charge_rent, apply_late_fee, waive_late_fee, process_all_rent, process_all_late_fees`);
    }

    return jsonResponse({ success: true, data: result });
  } catch (error) {
    console.error('Error processing rent action:', error);
    
    return jsonResponse(
      {
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      error instanceof HttpError ? error.status : 400
    );
  }
});

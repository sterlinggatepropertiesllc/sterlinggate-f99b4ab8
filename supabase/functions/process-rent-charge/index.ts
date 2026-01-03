import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action, tenant_id, rent_charge_id, rent_period, manager_id, override_amount } = await req.json();
    
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
          _created_by: manager_id || null,
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
          _created_by: manager_id || null,
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
          _waived_by: manager_id || null,
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

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing rent action:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

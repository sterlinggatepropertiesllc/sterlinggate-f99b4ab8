import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Building2, CreditCard } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface PaymentMethodSettings {
  ach_enabled: boolean;
  card_enabled: boolean;
  card_fee_percentage: number;
}

export function PaymentMethodSettings() {
  const [settings, setSettings] = useState<PaymentMethodSettings>({
    ach_enabled: true,
    card_enabled: true,
    card_fee_percentage: 3.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_methods')
          .single();

        if (!error && data) {
          setSettings(data.value as unknown as PaymentMethodSettings);
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'payment_methods')
        .single();

      const valueAsJson = settings as unknown as Json;

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: valueAsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'payment_methods');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert([{
            key: 'payment_methods',
            value: valueAsJson,
          }]);

        if (error) throw error;
      }

      toast.success('Payment method settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-1">Accepted Payment Methods</h4>
        <p className="text-xs text-muted-foreground">
          Choose which payment methods tenants can use
        </p>
      </div>

      <div className="space-y-4">
        {/* ACH Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <Label className="font-medium">Bank Account (ACH)</Label>
              <p className="text-xs text-muted-foreground">
                You absorb the fee (~0.8%, max $5)
              </p>
            </div>
          </div>
          <Switch
            checked={settings.ach_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, ach_enabled: checked }))
            }
          />
        </div>

        {/* Card Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <Label className="font-medium">Credit/Debit Card</Label>
              <p className="text-xs text-muted-foreground">
                Tenant pays the convenience fee
              </p>
            </div>
          </div>
          <Switch
            checked={settings.card_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, card_enabled: checked }))
            }
          />
        </div>
      </div>

      <Separator />

      {/* Card Fee Percentage */}
      <div className="space-y-2">
        <Label htmlFor="card-fee">Card Convenience Fee (%)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="card-fee"
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={settings.card_fee_percentage}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                card_fee_percentage: parseFloat(e.target.value) || 0,
              }))
            }
            className="max-w-[100px]"
          />
          <span className="text-muted-foreground">%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This fee is added to card payments and paid by the tenant.
          Typical range: 2.5% - 3.5%
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Payment Settings
      </Button>
    </div>
  );
}

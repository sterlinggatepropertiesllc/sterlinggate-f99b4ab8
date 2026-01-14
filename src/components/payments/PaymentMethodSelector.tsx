import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export type PaymentMethodType = 'ach' | 'card';

interface PaymentMethodSettings {
  ach_enabled: boolean;
  card_enabled: boolean;
  card_fee_percentage: number;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType | null;
  onMethodSelect: (method: PaymentMethodType) => void;
  baseAmount: number; // In dollars
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  baseAmount,
}: PaymentMethodSelectorProps) {
  const [settings, setSettings] = useState<PaymentMethodSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_methods')
          .single();

        if (error) {
          // Default settings if not found
          setSettings({
            ach_enabled: true,
            card_enabled: true,
            card_fee_percentage: 3.0,
          });
        } else {
          setSettings(data.value as unknown as PaymentMethodSettings);
        }
      } catch {
        setSettings({
          ach_enabled: true,
          card_enabled: true,
          card_fee_percentage: 3.0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return null;

  const cardFee = baseAmount * (settings.card_fee_percentage / 100);
  const cardTotal = baseAmount + cardFee;

  return (
    <div className="space-y-3">
      <Label className="text-sm text-muted-foreground">Choose Payment Method</Label>
      <RadioGroup
        value={selectedMethod || ''}
        onValueChange={(value) => onMethodSelect(value as PaymentMethodType)}
        className="space-y-3"
      >
        {/* ACH Option */}
        {settings.ach_enabled && (
          <div
            className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-all ${
              selectedMethod === 'ach'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onMethodSelect('ach')}
          >
            <RadioGroupItem value="ach" id="ach" className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="ach" className="font-medium cursor-pointer">
                  Bank Account (ACH)
                </Label>
                <Badge variant="secondary" className="bg-success/10 text-success ml-auto">
                  No Fee
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Direct bank transfer • Funds arrive in 4-5 business days
              </p>
              <div className="mt-2 text-sm">
                <span className="font-medium">${baseAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Card Option */}
        {settings.card_enabled && (
          <div
            className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-all ${
              selectedMethod === 'card'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onMethodSelect('card')}
          >
            <RadioGroupItem value="card" id="card" className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="card" className="font-medium cursor-pointer">
                  Credit or Debit Card
                </Label>
                <Badge variant="secondary" className="bg-warning/10 text-warning ml-auto">
                  +${cardFee.toFixed(2)} Fee
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Instant processing • {settings.card_fee_percentage}% convenience fee applies
              </p>
              <div className="mt-2 text-sm space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment amount:</span>
                  <span>${baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Processing fee ({settings.card_fee_percentage}%):</span>
                  <span>${cardFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t border-border/50">
                  <span>Total:</span>
                  <span>${cardTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </RadioGroup>
    </div>
  );
}

export function usePaymentMethodSettings() {
  const [settings, setSettings] = useState<PaymentMethodSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_methods')
          .single();

        if (error) {
          setSettings({
            ach_enabled: true,
            card_enabled: true,
            card_fee_percentage: 3.0,
          });
        } else {
          setSettings(data.value as unknown as PaymentMethodSettings);
        }
      } catch {
        setSettings({
          ach_enabled: true,
          card_enabled: true,
          card_fee_percentage: 3.0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading };
}

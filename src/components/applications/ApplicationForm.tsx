import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SecureDocumentUpload } from './SecureDocumentUpload';
import { EncryptionBadge } from '@/components/ui/encryption-badge';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { StripeProvider } from '@/components/payments/StripeProvider';
import { EmbeddedPaymentForm } from '@/components/payments/EmbeddedPaymentForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Briefcase, 
  FileCheck, 
  Shield, 
  CreditCard,
  CheckCircle2,
  DollarSign,
  Loader2,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const applicationSchema = z.object({
  // Personal Info
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(14, 'Valid phone number is required'), // (555) 123-4567 format
  address: z.string().min(5, 'Current address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().min(5, 'Valid ZIP code is required'),
  
  // Financial Info (simplified)
  monthlyIncome: z.number().min(1, 'Monthly gross income is required'),
  cashOnHand: z.number().min(1, 'Cash on hand is required'),
  
  // Documents
  driversLicenseFront: z.string().min(1, 'Driver\'s license front is required'),
  driversLicenseBack: z.string().min(1, 'Driver\'s license back is required'),
  ssnCard: z.string().min(1, 'Social Security card is required'),
  
  // Consent
  backgroundCheckConsent: z.boolean().refine(val => val === true, 'You must consent to background check'),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the Terms of Service'),
  privacyAccepted: z.boolean().refine(val => val === true, 'You must accept the Privacy Policy'),
  nonRefundableAcknowledged: z.boolean().refine(val => val === true, 'You must acknowledge that the application fee is non-refundable'),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

interface ApplicationFormProps {
  userId: string;
  userEmail: string;
  propertyId: string;
  propertyAddress: string;
  applicationFee: string;
  applicationFeeAmount: number; // In cents
  onSaveApplication: (data: ApplicationFormData, paymentId: string) => Promise<boolean>;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

// Currency formatting helpers
const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? value.replace(/[^\d]/g, '') : String(value);
  if (!num) return '';
  return parseInt(num, 10).toLocaleString('en-US');
};

const parseCurrency = (value: string): number | undefined => {
  const num = value.replace(/[^\d]/g, '');
  return num ? parseInt(num, 10) : undefined;
};

const steps = [
  { id: 1, name: 'Personal Info', icon: User },
  { id: 2, name: 'Financials', icon: DollarSign },
  { id: 3, name: 'Documents', icon: FileCheck },
  { id: 4, name: 'Consent', icon: Shield },
  { id: 5, name: 'Review', icon: CheckCircle2 },
  { id: 6, name: 'Payment', icon: CreditCard },
];

export function ApplicationForm({
  userId,
  userEmail,
  propertyId,
  propertyAddress,
  applicationFee,
  applicationFeeAmount,
  onSaveApplication,
  onPaymentSuccess,
  onCancel,
}: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Store application data for payment step
  const [pendingApplicationData, setPendingApplicationData] = useState<ApplicationFormData | null>(null);
  
  // Currency display state for formatted inputs
  const [monthlyIncomeDisplay, setMonthlyIncomeDisplay] = useState('');
  const [cashOnHandDisplay, setCashOnHandDisplay] = useState('');
  
  // Embedded payment state
  const { createPaymentIntent, isCreating: isPaymentLoading } = useEmbeddedPayment();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Fetch Stripe publishable key on mount
  useEffect(() => {
    const fetchPublishableKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-stripe-publishable-key');
        if (error) throw error;
        if (data?.publishableKey) {
          setPublishableKey(data.publishableKey);
        }
      } catch (err) {
        console.error('[ApplicationForm] Failed to fetch publishable key:', err);
      }
    };
    fetchPublishableKey();
  }, []);
  
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      monthlyIncome: undefined as unknown as number, // Show placeholder instead of 0
      cashOnHand: undefined as unknown as number, // Show placeholder instead of 0
      driversLicenseFront: '',
      driversLicenseBack: '',
      ssnCard: '',
      backgroundCheckConsent: false,
      termsAccepted: false,
      privacyAccepted: false,
      nonRefundableAcknowledged: false,
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch, trigger } = form;
  const watchedValues = watch();

  // Premium phone formatting
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setValue('phone', formatted);
  };

  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof ApplicationFormData)[] = [];
    
    switch (step) {
      case 1:
        fieldsToValidate = ['fullName', 'phone', 'address', 'city', 'state', 'zipCode'];
        break;
      case 2:
        fieldsToValidate = ['monthlyIncome', 'cashOnHand'];
        break;
      case 3:
        fieldsToValidate = ['driversLicenseFront', 'driversLicenseBack', 'ssnCard'];
        break;
      case 4:
        fieldsToValidate = ['backgroundCheckConsent', 'termsAccepted', 'privacyAccepted'];
        break;
      default:
        return true;
    }
    
    const result = await trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Handle moving from Review (step 5) to Payment (step 6)
  const handleProceedToPayment = async (data: ApplicationFormData) => {
    // Validate the non-refundable acknowledgment
    if (!data.nonRefundableAcknowledged) {
      toast.error('Please acknowledge that the application fee is non-refundable');
      return;
    }
    
    setPendingApplicationData(data);
    setPaymentError(null);
    setIsSubmitting(true);
    
    try {
      console.log('[ApplicationForm] Creating payment intent for application fee');
      const result = await createPaymentIntent({
        payment_type: 'application_fee',
        property_id: propertyId,
        amount: applicationFeeAmount,
        payment_method: 'card', // Application fees are card-only
      });

      if (result?.clientSecret) {
        setClientSecret(result.clientSecret);
        setCurrentStep(6);
      } else {
        throw new Error('Failed to initialize payment');
      }
    } catch (error) {
      console.error('[ApplicationForm] Error:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setPaymentError(error instanceof Error ? error.message : 'Payment initialization failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingApplicationData) {
      toast.error('Application data not found');
      return;
    }
    
    try {
      // Save the application after successful payment
      const success = await onSaveApplication(pendingApplicationData, '');
      if (success) {
        toast.success('Application submitted successfully!');
        onPaymentSuccess();
      } else {
        toast.error('Failed to save application. Please contact support.');
      }
    } catch (error) {
      console.error('[ApplicationForm] Failed to save application:', error);
      toast.error('Failed to save application. Please contact support.');
    }
  };

  const handlePaymentError = (message: string) => {
    setPaymentError(message);
    toast.error(message);
  };
  
  // Currency input handlers
  const handleMonthlyIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setMonthlyIncomeDisplay(formatted);
    const parsed = parseCurrency(e.target.value);
    setValue('monthlyIncome', parsed as number);
  };
  
  const handleCashOnHandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setCashOnHandDisplay(formatted);
    const parsed = parseCurrency(e.target.value);
    setValue('cashOnHand', parsed as number);
  };


  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  currentStep >= step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs mt-1.5 hidden sm:block text-muted-foreground">{step.name}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-16 h-0.5 mx-2",
                  currentStep > step.id ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-serif mb-4">Personal Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Legal Name *</Label>
                <Input
                  id="fullName"
                  {...register('fullName')}
                  placeholder="John Michael Smith"
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={watchedValues.phone || ''}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  className={cn(
                    "font-mono tracking-wide",
                    errors.phone ? 'border-destructive' : ''
                  )}
                  maxLength={14}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Current Address *</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="123 Main Street, Apt 4B"
                  className={errors.address ? 'border-destructive' : ''}
                />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder="New York"
                    className={errors.city ? 'border-destructive' : ''}
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    {...register('state')}
                    placeholder="NY"
                    className={errors.state ? 'border-destructive' : ''}
                  />
                  {errors.state && (
                    <p className="text-xs text-destructive">{errors.state.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code *</Label>
                  <Input
                    id="zipCode"
                    {...register('zipCode')}
                    placeholder="10001"
                    className={errors.zipCode ? 'border-destructive' : ''}
                  />
                  {errors.zipCode && (
                    <p className="text-xs text-destructive">{errors.zipCode.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Financial Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-serif mb-4">Financial Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Monthly Gross Income ($) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="monthlyIncome"
                    type="text"
                    inputMode="numeric"
                    value={monthlyIncomeDisplay}
                    onChange={handleMonthlyIncomeChange}
                    placeholder="5,000"
                    className={cn(
                      "pl-9 font-mono tracking-wide",
                      errors.monthlyIncome ? 'border-destructive' : ''
                    )}
                  />
                </div>
                {errors.monthlyIncome && (
                  <p className="text-xs text-destructive">{errors.monthlyIncome.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cashOnHand">Cash on Hand / Savings ($) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cashOnHand"
                    type="text"
                    inputMode="numeric"
                    value={cashOnHandDisplay}
                    onChange={handleCashOnHandChange}
                    placeholder="10,000"
                    className={cn(
                      "pl-9 font-mono tracking-wide",
                      errors.cashOnHand ? 'border-destructive' : ''
                    )}
                  />
                </div>
                {errors.cashOnHand && (
                  <p className="text-xs text-destructive">{errors.cashOnHand.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Document Uploads */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif">Identity Verification</h3>
                <EncryptionBadge />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Please upload clear photos of your identification documents. All documents are encrypted and securely stored.
              </p>
              
              <SecureDocumentUpload
                label="Driver's License (Front) *"
                description="Upload a clear photo of the front of your driver's license or state ID"
                userId={userId}
                documentType="drivers-license-front"
                onUploadComplete={(url) => setValue('driversLicenseFront', url)}
                currentUrl={watchedValues.driversLicenseFront}
              />
              {errors.driversLicenseFront && (
                <p className="text-xs text-destructive">{errors.driversLicenseFront.message}</p>
              )}

              <SecureDocumentUpload
                label="Driver's License (Back) *"
                description="Upload a clear photo of the back of your driver's license or state ID"
                userId={userId}
                documentType="drivers-license-back"
                onUploadComplete={(url) => setValue('driversLicenseBack', url)}
                currentUrl={watchedValues.driversLicenseBack}
              />
              {errors.driversLicenseBack && (
                <p className="text-xs text-destructive">{errors.driversLicenseBack.message}</p>
              )}

              <SecureDocumentUpload
                label="Social Security Card (Front Only) *"
                description="Upload a clear photo of the front of your Social Security card"
                userId={userId}
                documentType="ssn-card"
                onUploadComplete={(url) => setValue('ssnCard', url)}
                currentUrl={watchedValues.ssnCard}
              />
              {errors.ssnCard && (
                <p className="text-xs text-destructive">{errors.ssnCard.message}</p>
              )}
            </div>
          )}

          {/* Step 4: Background Check Consent */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-serif mb-4">Background Check Authorization</h3>
              
              <Card className="bg-secondary/50">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-medium">Authorization for Background Screening</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    By checking the box below, you authorize Sterling Gate Properties and its designated 
                    third-party consumer reporting agencies to obtain and review the following information 
                    for the purpose of evaluating your rental application:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Consumer credit reports from one or more credit bureaus</li>
                    <li>Criminal background history (national, state, and local records)</li>
                    <li>Sex offender registry records</li>
                    <li>Eviction history and landlord-tenant court records</li>
                    <li>Employment verification and income confirmation</li>
                    <li>Identity verification</li>
                    <li>Terrorist watch list and sanctions screenings</li>
                  </ul>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You understand that this information will be used to make a rental decision and that 
                    you have the right to request a copy of any consumer report obtained. You also understand 
                    that if adverse action is taken based on information in a consumer report, you will be 
                    provided with the name and address of the consumer reporting agency that furnished the report.
                  </p>
                </CardContent>
              </Card>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="backgroundCheckConsent"
                  checked={watchedValues.backgroundCheckConsent}
                  onCheckedChange={(checked) => setValue('backgroundCheckConsent', checked === true)}
                />
                <div className="space-y-1">
                  <label htmlFor="backgroundCheckConsent" className="text-sm font-medium cursor-pointer">
                    I authorize the background check described above *
                  </label>
                  {errors.backgroundCheckConsent && (
                    <p className="text-xs text-destructive">{errors.backgroundCheckConsent.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="termsAccepted"
                  checked={watchedValues.termsAccepted}
                  onCheckedChange={(checked) => setValue('termsAccepted', checked === true)}
                />
                <div className="space-y-1">
                  <label htmlFor="termsAccepted" className="text-sm cursor-pointer">
                    I have read and agree to the{' '}
                    <Link to="/terms-of-service" target="_blank" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{' '}
                    *
                  </label>
                  {errors.termsAccepted && (
                    <p className="text-xs text-destructive">{errors.termsAccepted.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="privacyAccepted"
                  checked={watchedValues.privacyAccepted}
                  onCheckedChange={(checked) => setValue('privacyAccepted', checked === true)}
                />
                <div className="space-y-1">
                  <label htmlFor="privacyAccepted" className="text-sm cursor-pointer">
                    I have read and agree to the{' '}
                    <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>{' '}
                    *
                  </label>
                  {errors.privacyAccepted && (
                    <p className="text-xs text-destructive">{errors.privacyAccepted.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-serif mb-4">Review Your Application</h3>
              
              <div className="grid gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {watchedValues.fullName}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {watchedValues.phone}</div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Address:</span> {watchedValues.address}, {watchedValues.city}, {watchedValues.state} {watchedValues.zipCode}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Financial Information
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Monthly Gross Income:</span> ${watchedValues.monthlyIncome?.toLocaleString()}</div>
                      <div><span className="text-muted-foreground">Cash on Hand:</span> ${watchedValues.cashOnHand?.toLocaleString()}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-primary" />
                      Documents Uploaded
                    </h4>
                    <div className="flex items-center gap-4 text-sm">
                      {watchedValues.driversLicenseFront && (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          License Front
                        </div>
                      )}
                      {watchedValues.driversLicenseBack && (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          License Back
                        </div>
                      )}
                      {watchedValues.ssnCard && (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          SSN Card
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-warning/5 border-warning/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-warning/20">
                        <DollarSign className="h-6 w-6 text-warning" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Application Fee: {applicationFee}</h4>
                        <p className="text-sm text-muted-foreground">
                          Non-refundable fee for background check and application processing
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Non-Refundable Acknowledgment */}
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-destructive">Important Notice</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          The application fee of <strong>{applicationFee}</strong> is <strong>non-refundable</strong> regardless of whether your application is approved or denied. This fee covers the cost of background checks and application processing.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="nonRefundableAcknowledged"
                          checked={watchedValues.nonRefundableAcknowledged}
                          onCheckedChange={(checked) => setValue('nonRefundableAcknowledged', checked === true)}
                        />
                        <div>
                          <label htmlFor="nonRefundableAcknowledged" className="text-sm font-medium cursor-pointer">
                            I understand and agree that this application fee is non-refundable *
                          </label>
                          {errors.nonRefundableAcknowledged && (
                            <p className="text-xs text-destructive mt-1">{errors.nonRefundableAcknowledged.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Property: <strong>{propertyAddress}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Payment */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h3 className="text-lg font-serif mb-4">Complete Payment</h3>
              
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Application Fee</h4>
                      <p className="text-sm text-muted-foreground">
                        For property: {propertyAddress}
                      </p>
                    </div>
                    <div className="text-xl font-bold">{applicationFee}</div>
                  </div>
                </CardContent>
              </Card>

              {paymentError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">{paymentError}</p>
                </div>
              )}

              {clientSecret && publishableKey ? (
                <StripeProvider clientSecret={clientSecret} publishableKey={publishableKey}>
                  <EmbeddedPaymentForm
                    amount={applicationFeeAmount / 100}
                    convenienceFee={0}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    returnUrl={`${window.location.origin}/payment-success?type=application`}
                  />
                </StripeProvider>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep !== 6 && (
            <div className="flex justify-between mt-8 pt-4 border-t border-border">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              
              {currentStep < 5 ? (
                <Button type="button" onClick={handleNext} className="btn-platinum">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleSubmit(handleProceedToPayment)} 
                  disabled={isSubmitting || isPaymentLoading} 
                  className="btn-platinum"
                >
                  {isSubmitting || isPaymentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </form>
    </div>
  );
}

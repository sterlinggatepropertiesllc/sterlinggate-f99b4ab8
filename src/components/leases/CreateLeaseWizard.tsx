import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTenantProfiles } from '@/hooks/useProfiles';
import { useCreateLease } from '@/hooks/useLeases';
import { generateLeaseHTML, LeaseTerms, LeaseType, LEASE_TYPE_LABELS, LEASE_TYPE_DESCRIPTIONS } from '@/lib/leaseTemplates';
import { generateDocumentHash } from '@/hooks/useSignatures';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  User, 
  Home, 
  FileText, 
  DollarSign, 
  Send,
  Building2,
  Calendar,
  Shield
} from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rent_amount: number;
}

interface CreateLeaseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  managerId: string;
  managerName: string;
  managerEmail: string;
}

const STEPS = [
  { id: 'tenant', label: 'Select Tenant', icon: User },
  { id: 'property', label: 'Select Property', icon: Home },
  { id: 'type', label: 'Lease Type', icon: FileText },
  { id: 'terms', label: 'Lease Terms', icon: DollarSign },
  { id: 'additional', label: 'Additional Clauses', icon: Shield },
  { id: 'preview', label: 'Preview & Send', icon: Send },
];

export function CreateLeaseWizard({ 
  open, 
  onOpenChange, 
  properties, 
  managerId,
  managerName,
  managerEmail
}: CreateLeaseWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    tenantId: '',
    tenantName: '',
    tenantEmail: '',
    propertyId: '',
    leaseType: 'gross' as LeaseType,
    startDate: '',
    endDate: '',
    monthlyRent: 0,
    securityDeposit: 0,
    camCharges: 0,
    propertyTaxResponsibility: 'landlord' as 'landlord' | 'tenant' | 'shared',
    insuranceResponsibility: 'tenant' as 'landlord' | 'tenant' | 'both',
    lateFeePercentage: 5,
    gracePeriodDays: 5,
    renewalTerms: '',
    additionalClauses: '',
  });

  const { data: tenants, isLoading: tenantsLoading } = useTenantProfiles();
  const createLease = useCreateLease();

  const selectedProperty = properties.find(p => p.id === formData.propertyId);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSelectTenant = (tenantId: string) => {
    const tenant = tenants?.find(t => t.id === tenantId);
    if (tenant) {
      updateFormData({
        tenantId: tenant.id,
        tenantName: tenant.full_name || tenant.email,
        tenantEmail: tenant.email,
      });
    }
  };

  const handleSelectProperty = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    if (property) {
      updateFormData({
        propertyId: property.id,
        monthlyRent: property.rent_amount,
        securityDeposit: property.rent_amount * 2, // Default to 2 months
      });
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!formData.tenantId;
      case 1: return !!formData.propertyId;
      case 2: return !!formData.leaseType;
      case 3: return formData.startDate && formData.endDate && formData.monthlyRent > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!selectedProperty) return;

    const leaseTerms: LeaseTerms = {
      leaseType: formData.leaseType,
      propertyAddress: selectedProperty.address,
      propertyCity: selectedProperty.city,
      propertyState: selectedProperty.state,
      propertyZip: selectedProperty.zip_code,
      landlordName: managerName,
      landlordEmail: managerEmail,
      tenantName: formData.tenantName,
      tenantEmail: formData.tenantEmail,
      startDate: formData.startDate,
      endDate: formData.endDate,
      monthlyRent: formData.monthlyRent,
      securityDeposit: formData.securityDeposit,
      camCharges: formData.camCharges,
      propertyTaxResponsibility: formData.propertyTaxResponsibility,
      insuranceResponsibility: formData.insuranceResponsibility,
      lateFeePercentage: formData.lateFeePercentage,
      gracePeriodDays: formData.gracePeriodDays,
      renewalTerms: formData.renewalTerms,
      additionalClauses: formData.additionalClauses,
    };

    // Generate document hash
    const documentContent = JSON.stringify(leaseTerms) + new Date().toISOString();
    const documentHash = await generateDocumentHash(documentContent);

    const leaseResult = await createLease.mutateAsync({
      property_id: formData.propertyId,
      tenant_id: formData.tenantId,
      manager_id: managerId,
      start_date: formData.startDate,
      end_date: formData.endDate,
      monthly_rent: formData.monthlyRent,
      security_deposit: formData.securityDeposit,
      lease_type: formData.leaseType,
      cam_charges: formData.camCharges || null,
      property_tax_responsibility: formData.propertyTaxResponsibility,
      insurance_responsibility: formData.insuranceResponsibility,
      late_fee_percentage: formData.lateFeePercentage,
      grace_period_days: formData.gracePeriodDays,
      renewal_terms: formData.renewalTerms || null,
      additional_clauses: formData.additionalClauses || null,
      terms: generateLeaseHTML(leaseTerms),
      status: 'pending_tenant_signature',
      document_hash: documentHash,
    });

    // Notify tenant about the new lease awaiting signature
    if (leaseResult?.id) {
      await supabase.rpc('create_notification', {
        _user_id: formData.tenantId,
        _type: 'lease_signed',
        _title: 'New Lease Agreement',
        _message: `You have a new lease agreement for ${selectedProperty.address} awaiting your signature.`,
        _metadata: { lease_id: leaseResult.id, property_id: formData.propertyId }
      });
    }

    onOpenChange(false);
    setCurrentStep(0);
    setFormData({
      tenantId: '',
      tenantName: '',
      tenantEmail: '',
      propertyId: '',
      leaseType: 'gross',
      startDate: '',
      endDate: '',
      monthlyRent: 0,
      securityDeposit: 0,
      camCharges: 0,
      propertyTaxResponsibility: 'landlord',
      insuranceResponsibility: 'tenant',
      lateFeePercentage: 5,
      gracePeriodDays: 5,
      renewalTerms: '',
      additionalClauses: '',
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Select Tenant
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Select a tenant who has registered on the platform to create a lease for.
            </p>
            {tenantsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : tenants && tenants.length > 0 ? (
              <div className="grid gap-3">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => handleSelectTenant(tenant.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      formData.tenantId === tenant.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50 bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {tenant.full_name || 'No name provided'}
                        </p>
                        <p className="text-sm text-muted-foreground">{tenant.email}</p>
                      </div>
                      {formData.tenantId === tenant.id && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No tenants have registered yet.</p>
                <p className="text-sm">Tenants need to create an account first.</p>
              </div>
            )}
          </div>
        );

      case 1: // Select Property
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Choose the property this lease will be for.
            </p>
            <div className="grid gap-3">
              {properties.map((property) => (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => handleSelectProperty(property.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.propertyId === property.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 bg-secondary/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{property.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.city}, {property.state} {property.zip_code}
                      </p>
                      <p className="text-sm text-primary font-medium mt-1">
                        ${property.rent_amount.toLocaleString()}/month
                      </p>
                    </div>
                    {formData.propertyId === property.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2: // Lease Type
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Select the type of commercial lease agreement.
            </p>
            <div className="grid gap-3">
              {(Object.keys(LEASE_TYPE_LABELS) as LeaseType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateFormData({ leaseType: type })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.leaseType === type
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 bg-secondary/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{LEASE_TYPE_LABELS[type]}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {LEASE_TYPE_DESCRIPTIONS[type]}
                      </p>
                    </div>
                    {formData.leaseType === type && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3: // Lease Terms
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateFormData({ startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateFormData({ endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Rent ($)</Label>
                <Input
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => updateFormData({ monthlyRent: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Security Deposit ($)</Label>
                <Input
                  type="number"
                  value={formData.securityDeposit}
                  onChange={(e) => updateFormData({ securityDeposit: Number(e.target.value) })}
                />
              </div>
            </div>

            {formData.leaseType === 'triple_net' && (
              <div className="space-y-2">
                <Label>Monthly CAM Charges ($)</Label>
                <Input
                  type="number"
                  value={formData.camCharges}
                  onChange={(e) => updateFormData({ camCharges: Number(e.target.value) })}
                  placeholder="Common Area Maintenance charges"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property Tax Responsibility</Label>
                <Select
                  value={formData.propertyTaxResponsibility}
                  onValueChange={(v) => updateFormData({ 
                    propertyTaxResponsibility: v as 'landlord' | 'tenant' | 'shared' 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landlord">Landlord</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Insurance Responsibility</Label>
                <Select
                  value={formData.insuranceResponsibility}
                  onValueChange={(v) => updateFormData({ 
                    insuranceResponsibility: v as 'landlord' | 'tenant' | 'both' 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landlord">Landlord</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="both">Both Parties</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Late Fee (%)</Label>
                <Input
                  type="number"
                  value={formData.lateFeePercentage}
                  onChange={(e) => updateFormData({ lateFeePercentage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Grace Period (days)</Label>
                <Input
                  type="number"
                  value={formData.gracePeriodDays}
                  onChange={(e) => updateFormData({ gracePeriodDays: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        );

      case 4: // Additional Clauses
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Renewal Terms (Optional)</Label>
              <Textarea
                value={formData.renewalTerms}
                onChange={(e) => updateFormData({ renewalTerms: e.target.value })}
                placeholder="e.g., Tenant has the option to renew for an additional 12-month term with 60 days written notice..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Clauses (Optional)</Label>
              <Textarea
                value={formData.additionalClauses}
                onChange={(e) => updateFormData({ additionalClauses: e.target.value })}
                placeholder="Add any custom terms, special conditions, or modifications to the standard lease..."
                rows={6}
              />
            </div>
          </div>
        );

      case 5: // Preview & Send
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{LEASE_TYPE_LABELS[formData.leaseType]}</Badge>
              <Badge variant="secondary">
                <Calendar className="h-3 w-3 mr-1" />
                {formData.startDate} to {formData.endDate}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="text-sm text-muted-foreground">Tenant</p>
                <p className="font-medium">{formData.tenantName}</p>
                <p className="text-sm text-muted-foreground">{formData.tenantEmail}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property</p>
                <p className="font-medium">{selectedProperty?.address}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedProperty?.city}, {selectedProperty?.state}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Rent</p>
                <p className="font-medium text-lg">${formData.monthlyRent.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Security Deposit</p>
                <p className="font-medium text-lg">${formData.securityDeposit.toLocaleString()}</p>
              </div>
              {formData.camCharges > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">CAM Charges</p>
                  <p className="font-medium text-lg">${formData.camCharges.toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-foreground mb-2">
                What happens next?
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>The lease will be generated and sent to the tenant</li>
                <li>Tenant will receive a notification to sign</li>
                <li>Once signed, you'll be notified for counter-signature</li>
                <li>Both signatures create a legally binding document</li>
              </ol>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Create New Lease</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2 py-4 border-b border-border">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex flex-col items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-success text-success-foreground' 
                      : isCurrent 
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background' 
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 mx-2 ${
                    isCompleted ? 'bg-success' : 'bg-border'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 px-1">
          <div className="py-4">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="btn-platinum"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createLease.isPending}
              className="btn-platinum"
            >
              {createLease.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create & Send Lease
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

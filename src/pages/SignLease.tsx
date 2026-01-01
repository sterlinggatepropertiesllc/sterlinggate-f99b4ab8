import { useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLease, useUpdateLease } from '@/hooks/useLeases';
import { useCreateSignature, getClientIP } from '@/hooks/useSignatures';
import { useProfile } from '@/hooks/useProfiles';
import { SignaturePad } from '@/components/signatures/SignaturePad';
import { AuditCertificate } from '@/components/leases/AuditCertificate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  ArrowLeft,
  Download,
  Shield,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function SignLease() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: lease, isLoading: leaseLoading } = useLease(id);
  const { data: tenantProfile } = useProfile(lease?.tenant_id);
  const { data: managerProfile } = useProfile(lease?.manager_id);
  const updateLease = useUpdateLease();
  const createSignature = useCreateSignature();

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isLoading = authLoading || leaseLoading;
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading lease document...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!lease) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-serif mb-2">Lease Not Found</h2>
          <p className="text-muted-foreground mb-4">The lease document you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </Card>
      </div>
    );
  }

  // Determine user's role in this lease
  const isTenant = user.id === lease.tenant_id;
  const isManager = user.id === lease.manager_id;
  const canSign = 
    (isTenant && lease.status === 'pending_tenant_signature') ||
    (isManager && lease.status === 'pending_manager_signature');

  // Check if user has already signed
  const userSignature = lease.signatures?.find((s: any) => s.signer_id === user.id);
  const hasSigned = !!userSignature;

  // Get signer names for certificate
  const signerNames: Record<string, string> = {};
  if (tenantProfile) signerNames[lease.tenant_id] = tenantProfile.full_name || tenantProfile.email;
  if (managerProfile) signerNames[lease.manager_id] = managerProfile.full_name || managerProfile.email;

  const handleSignatureChange = (data: string | null, type: 'draw' | 'type') => {
    setSignatureData(data);
    setSignatureType(type);
  };

  const handleSign = async () => {
    if (!signatureData || !termsAccepted) {
      toast.error('Please provide your signature and accept the terms');
      return;
    }

    setSigning(true);
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;

      // Create signature
      await createSignature.mutateAsync({
        leaseId: lease.id,
        signerId: user.id,
        signatureData,
        signatureType,
        ipAddress,
        userAgent,
      });

      // Update lease status
      let newStatus = lease.status;
      if (isTenant && lease.status === 'pending_tenant_signature') {
        newStatus = 'pending_manager_signature';
        
        // Notify manager that tenant has signed
        await supabase.rpc('create_notification', {
          _user_id: lease.manager_id,
          _type: 'lease_signed',
          _title: 'Tenant Signed Lease',
          _message: `${tenantProfile?.full_name || 'Tenant'} has signed the lease for ${lease.properties?.address}. Your counter-signature is needed.`,
          _metadata: { lease_id: lease.id, property_id: lease.property_id }
        });
      } else if (isManager && lease.status === 'pending_manager_signature') {
        newStatus = 'completed';
        
        // Notify tenant that lease is fully executed
        await supabase.rpc('create_notification', {
          _user_id: lease.tenant_id,
          _type: 'lease_signed',
          _title: 'Lease Fully Executed',
          _message: `Your lease for ${lease.properties?.address} has been fully signed by both parties.`,
          _metadata: { lease_id: lease.id, property_id: lease.property_id }
        });
      }

      await updateLease.mutateAsync({
        id: lease.id,
        status: newStatus,
      });

      toast.success('Lease signed successfully!');
      
      if (newStatus === 'completed') {
        setShowCertificate(true);
      } else {
        navigate(isTenant ? '/tenant' : '/dashboard');
      }
    } catch (error) {
      console.error('Signing error:', error);
      toast.error('Failed to sign lease. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await supabase.functions.invoke('generate-lease-pdf', {
        body: { leaseId: lease.id }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // The edge function returns ArrayBuffer, convert to blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lease-${lease.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getStatusMessage = () => {
    switch (lease.status) {
      case 'draft':
        return 'This lease is still in draft status.';
      case 'pending_tenant_signature':
        return isTenant 
          ? 'Please review and sign this lease agreement.' 
          : 'Waiting for tenant signature.';
      case 'pending_manager_signature':
        return isManager 
          ? 'The tenant has signed. Please review and counter-sign.' 
          : 'Waiting for landlord counter-signature.';
      case 'completed':
        return 'This lease has been fully executed by both parties.';
      case 'expired':
        return 'This lease has expired.';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline"
              className={
                lease.status === 'completed' ? 'border-success text-success bg-success/10' :
                lease.status.includes('pending') ? 'border-warning text-warning bg-warning/10' :
                'border-muted text-muted-foreground'
              }
            >
              {lease.status.replace(/_/g, ' ')}
            </Badge>
            
            {lease.status === 'completed' && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCertificate(true)}>
                  <Shield className="h-4 w-4 mr-2" /> View Certificate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Lease Document */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-serif text-xl">Lease Agreement</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {lease.properties?.address}, {lease.properties?.city}, {lease.properties?.state}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-6">
                    {lease.terms ? (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: lease.terms }}
                      />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Lease document content not available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Lease Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">Lease Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Term</p>
                    <p className="font-medium">
                      {format(new Date(lease.start_date), 'MMM d, yyyy')} - {format(new Date(lease.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Rent</p>
                    <p className="font-medium text-lg">${Number(lease.monthly_rent).toLocaleString()}</p>
                  </div>
                </div>
                
                {lease.security_deposit && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Security Deposit</p>
                        <p className="font-medium">${Number(lease.security_deposit).toLocaleString()}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Status Message */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <p className="text-sm">{getStatusMessage()}</p>
              </CardContent>
            </Card>

            {/* Signature Section */}
            {canSign && !hasSigned && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-serif">Your Signature</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SignaturePad onSignatureChange={handleSignatureChange} />
                  
                  <Separator />
                  
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                      I have read and agree to all terms in this lease agreement. I understand this is a legally binding document.
                    </Label>
                  </div>
                  
                  <Button 
                    className="w-full btn-platinum" 
                    onClick={handleSign}
                    disabled={!signatureData || !termsAccepted || signing}
                  >
                    {signing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Sign Lease
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Already Signed */}
            {hasSigned && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <p className="font-medium">You have signed this lease</p>
                      <p className="text-sm text-muted-foreground">
                        Signed on {format(new Date(userSignature.signed_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Signatures List */}
            {lease.signatures && lease.signatures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-serif">Signatures</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lease.signatures.map((sig: any) => (
                    <div key={sig.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">
                          {signerNames[sig.signer_id] || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sig.signed_at), 'PPp')}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Dialog */}
      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Document Certificate</DialogTitle>
          </DialogHeader>
          <AuditCertificate
            leaseId={lease.id}
            documentHash={lease.document_hash}
            createdAt={lease.created_at}
            signatures={lease.signatures || []}
            signerNames={signerNames}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

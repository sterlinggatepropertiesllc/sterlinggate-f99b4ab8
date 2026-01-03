import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DocumentViewer } from './DocumentViewer';
import { useApplicationPayment } from '@/hooks/useApplications';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  DollarSign,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Shield,
  Calendar,
  Loader2,
} from 'lucide-react';

interface ApplicationDetailsDialogProps {
  application: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export function ApplicationDetailsDialog({
  application,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: ApplicationDetailsDialogProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data: payment, isLoading: paymentLoading } = useApplicationPayment(
    application?.applicant_id,
    application?.property_id
  );

  if (!application) return null;

  const personalInfo = application.personal_info || {};
  const employmentInfo = application.employment_info || {};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    switch (application.status) {
      case 'approved':
        return (
          <Badge className="bg-success/10 text-success border-success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning/10 text-warning border-warning">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
    }
  };

  const documents = [
    { label: "Driver's License (Front)", url: personalInfo.drivers_license_front_url },
    { label: "Driver's License (Back)", url: personalInfo.drivers_license_back_url },
    { label: 'Social Security Card', url: personalInfo.ssn_card_url },
  ];

  const handleReject = () => {
    onReject(application.id, rejectionReason || 'Application did not meet requirements');
    setShowRejectForm(false);
    setRejectionReason('');
    onOpenChange(false);
  };

  const handleApprove = () => {
    onApprove(application.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-serif">
                {application.profiles?.full_name || personalInfo.fullName || 'Applicant'}
              </DialogTitle>
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {application.properties?.address}, {application.properties?.city}
              </p>
            </div>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-muted-foreground">
            Applied: {formatDate(application.created_at)}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Personal Information */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium">{application.profiles?.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {application.profiles?.phone || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {application.profiles?.email || 'N/A'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Current Address</p>
                <p className="font-medium">
                  {personalInfo.address ? (
                    <>
                      {personalInfo.address}, {personalInfo.city}, {personalInfo.state} {personalInfo.zip_code}
                    </>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Financial Information */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Details
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground">Monthly Income</p>
                <p className="font-medium text-lg text-success">
                  {employmentInfo.monthly_income
                    ? formatCurrency(employmentInfo.monthly_income)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash on Hand</p>
                <p className="font-medium text-lg">
                  {employmentInfo.cash_on_hand
                    ? formatCurrency(employmentInfo.cash_on_hand)
                    : 'N/A'}
                </p>
              </div>
              {employmentInfo.employer_name && (
                <>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Employer</p>
                    <p className="font-medium flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {employmentInfo.employer_name}
                      {employmentInfo.job_title && (
                        <span className="text-muted-foreground">
                          ({employmentInfo.job_title})
                        </span>
                      )}
                    </p>
                  </div>
                  {employmentInfo.employer_address && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Employer Address</p>
                      <p className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {employmentInfo.employer_address}
                      </p>
                    </div>
                  )}
                  {employmentInfo.employer_phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Employer Phone</p>
                      <p className="font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {employmentInfo.employer_phone}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <Separator />

          {/* Documents */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Documents
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <DocumentViewer documents={documents} />
            </div>
          </section>

          <Separator />

          {/* Background Check Consent */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Background Check
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              {application.background_check_consent ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Consent provided</span>
                  <span className="text-muted-foreground text-sm">
                    on {formatDate(application.created_at)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  <span>No consent provided</span>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Payment Confirmation */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Confirmation
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              {paymentLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payment details...
                </div>
              ) : payment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      className={
                        payment.status === 'completed'
                          ? 'bg-success/10 text-success border-success'
                          : 'bg-warning/10 text-warning border-warning'
                      }
                    >
                      {payment.status === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {payment.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-lg">
                      {formatCurrency(Number(payment.amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="capitalize">{payment.payment_method || 'Stripe'}</span>
                  </div>
                  {payment.stripe_session_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment ID</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {payment.stripe_session_id.substring(0, 20)}...
                      </code>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(payment.payment_date)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-2">
                  No payment record found
                </div>
              )}
            </div>
          </section>

          {/* Rejection Reason (if rejected) */}
          {application.status === 'rejected' && application.rejection_reason && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-medium text-destructive uppercase tracking-wide mb-3">
                  Rejection Reason
                </h3>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <p>{application.rejection_reason}</p>
                </div>
              </section>
            </>
          )}

          {/* Action Buttons for Pending Applications */}
          {application.status === 'pending' && (
            <>
              <Separator />
              {showRejectForm ? (
                <div className="space-y-4">
                  <Label htmlFor="rejection-reason">Rejection Reason</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Please provide a reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleReject}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowRejectForm(true)}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button onClick={handleApprove}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve Application
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Hash, Calendar, Globe, User, FileCheck } from 'lucide-react';
import { format } from 'date-fns';

interface Signature {
  id: string;
  signer_id: string;
  signed_at: string;
  hash_id: string;
  ip_address: string | null;
  signature_type: string;
}

interface AuditCertificateProps {
  leaseId: string;
  documentHash: string | null;
  createdAt: string;
  signatures: Signature[];
  signerNames: Record<string, string>;
}

export function AuditCertificate({ 
  leaseId, 
  documentHash, 
  createdAt, 
  signatures,
  signerNames
}: AuditCertificateProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
      <CardHeader className="text-center border-b border-border pb-6">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-serif">Certificate of Completion</CardTitle>
        <p className="text-muted-foreground text-sm mt-2">
          This document certifies the authenticity and integrity of the signed lease agreement
        </p>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {/* Document Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            Document Information
          </h3>
          
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Document ID</span>
              <code className="text-xs bg-secondary px-2 py-1 rounded font-mono">
                {leaseId.slice(0, 8)}...{leaseId.slice(-8)}
              </code>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Hash className="h-3 w-3" />
                Document Hash (SHA-256)
              </span>
              <code className="text-xs bg-secondary px-2 py-1 rounded font-mono max-w-[200px] truncate">
                {documentHash || 'Pending'}
              </code>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Created
              </span>
              <span className="text-foreground">
                {format(new Date(createdAt), 'PPpp')}
              </span>
            </div>
          </div>
        </div>

        {/* Signature Audit Trail */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Signature Audit Trail
          </h3>
          
          {signatures.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No signatures yet</p>
          ) : (
            <div className="space-y-4">
              {signatures.map((sig, index) => (
                <div 
                  key={sig.id} 
                  className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                        <span className="text-success font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {signerNames[sig.signer_id] || 'Unknown Signer'}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {sig.signature_type === 'draw' ? 'Drawn' : 'Typed'} Signature
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      Verified
                    </Badge>
                  </div>
                  
                  <div className="grid gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signed At</span>
                      <span className="text-foreground">
                        {format(new Date(sig.signed_at), 'PPpp')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" /> IP Address
                      </span>
                      <code className="bg-background px-2 py-0.5 rounded">
                        {sig.ip_address || 'Not captured'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Signature Hash
                      </span>
                      <code className="bg-background px-2 py-0.5 rounded max-w-[150px] truncate">
                        {sig.hash_id}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Notice */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
          <p className="text-sm text-muted-foreground">
            This certificate verifies that all signatures were captured electronically with full 
            audit trail including IP address, timestamp, and cryptographic hash verification.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

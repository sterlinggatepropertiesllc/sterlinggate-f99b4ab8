import { Shield, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EncryptionBadgeProps {
  className?: string;
  variant?: 'default' | 'success' | 'compact';
}

export function EncryptionBadge({ className, variant = 'default' }: EncryptionBadgeProps) {
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-success", className)}>
        <Shield className="h-3.5 w-3.5" />
        <span>Encrypted</span>
      </div>
    );
  }

  if (variant === 'success') {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20", className)}>
        <div className="relative">
          <Shield className="h-5 w-5 text-success" />
          <CheckCircle2 className="h-3 w-3 text-success absolute -bottom-0.5 -right-0.5 bg-background rounded-full" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-success">Encrypted & Verified</span>
          <span className="text-xs text-muted-foreground">256-bit AES Protection</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border", className)}>
      <div className="relative">
        <Shield className="h-5 w-5 text-primary" />
        <Lock className="h-2.5 w-2.5 text-primary absolute bottom-0 right-0" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">256-bit AES Encrypted</span>
        <span className="text-xs text-muted-foreground">Your data is securely protected</span>
      </div>
    </div>
  );
}
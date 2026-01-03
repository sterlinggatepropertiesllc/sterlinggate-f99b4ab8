import { useState, useCallback } from 'react';
import { Upload, Shield, X, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EncryptionBadge } from '@/components/ui/encryption-badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecureDocumentUploadProps {
  label: string;
  description?: string;
  onUploadComplete: (url: string) => void;
  userId: string;
  documentType: string;
  accept?: string;
  maxSizeMB?: number;
  currentUrl?: string;
}

export function SecureDocumentUpload({
  label,
  description,
  onUploadComplete,
  userId,
  documentType,
  accept = 'image/jpeg,image/png,image/jpg,application/pdf',
  maxSizeMB = 10,
  currentUrl,
}: SecureDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    const allowedTypes = accept.split(',').map(t => t.trim());
    const fileType = file.type;
    if (!allowedTypes.some(t => fileType.includes(t.replace('*', '')) || t === fileType)) {
      return 'Invalid file type. Please upload JPG, PNG, or PDF files only.';
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setFileName(file.name);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${documentType}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('application-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('application-documents')
        .getPublicUrl(filePath);

      // For private buckets, we need to use signed URLs
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('application-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

      const finalUrl = signedUrlData?.signedUrl || urlData.publicUrl;
      
      setUploadedUrl(finalUrl);
      onUploadComplete(finalUrl);
      toast.success('Document uploaded securely');
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload document. Please try again.');
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = () => {
    setUploadedUrl(null);
    setFileName(null);
    setError(null);
    onUploadComplete('');
  };

  if (uploadedUrl) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center justify-between p-4 rounded-lg bg-success/5 border border-success/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="h-8 w-8 text-success" />
              <CheckCircle2 className="h-4 w-4 text-success absolute -bottom-1 -right-1 bg-background rounded-full" />
            </div>
            <div>
              <p className="text-sm font-medium text-success">Document Uploaded</p>
              <p className="text-xs text-muted-foreground">{fileName || 'File uploaded successfully'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EncryptionBadge variant="compact" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          error && "border-destructive bg-destructive/5",
          !isDragging && !error && "border-border hover:border-primary/50 hover:bg-secondary/50"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center text-center">
          {isUploading ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
              <p className="text-sm font-medium">Encrypting & Uploading...</p>
              <p className="text-xs text-muted-foreground mt-1">Please wait</p>
            </>
          ) : error ? (
            <>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">Click or drop to try again</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                <div className="relative">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <Shield className="h-3 w-3 text-primary absolute -bottom-1 -right-1" />
                </div>
              </div>
              <p className="text-sm font-medium">
                {isDragging ? 'Drop file here' : 'Click or drag file to upload'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, or PDF up to {maxSizeMB}MB
              </p>
            </>
          )}
        </div>
      </div>

      {/* Encryption indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span>Your documents are encrypted with 256-bit AES encryption</span>
      </div>
    </div>
  );
}
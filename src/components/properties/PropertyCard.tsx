import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminStatusBadge } from '@/components/admin/AdminDesignSystem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Building2, MoreVertical } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Property = Database['public']['Tables']['properties']['Row'];

interface PropertyCardProps {
  property: Property;
  onEdit: (property: Property) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: 'available' | 'occupied' | 'off_market') => void;
}

export function PropertyCard({ property, onEdit, onDelete, onStatusChange }: PropertyCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const primaryImage = property.photos && property.photos.length > 0 ? property.photos[0] : null;

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'occupied':
        return 'gold';
      default:
        return 'neutral';
    }
  };
  const statusLabel = property.status === 'off_market'
    ? 'Off Market'
    : property.status === 'available'
      ? 'Available'
      : property.status === 'occupied'
        ? 'Occupied'
        : 'Setup Needed';
  const propertyType = property.property_type || 'Commercial';
  const rent = Number(property.rent_amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <>
      <Card className="group overflow-hidden transition-colors hover:border-primary/30">
        <div className="relative h-32 overflow-hidden border-b border-border/60 bg-muted/20">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={property.address}
              className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,hsl(var(--muted)/0.24),hsl(var(--background)/0.18))]">
              <div className="text-center">
                <Building2 className="mx-auto h-7 w-7 text-muted-foreground/45" />
                <p className="mt-2 text-xs text-muted-foreground">No photo added</p>
              </div>
            </div>
          )}
          <div className="absolute left-3 top-3">
            <AdminStatusBadge tone={getStatusTone(property.status) as 'success' | 'gold' | 'neutral'}>
              {statusLabel}
            </AdminStatusBadge>
          </div>
          {property.photos && property.photos.length > 1 && (
            <div className="absolute bottom-3 left-3 rounded border border-border/60 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
              +{property.photos.length - 1} photos
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{property.address}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{property.city}, {property.state} {property.zip_code}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md border border-border/60 bg-card text-muted-foreground hover:text-primary">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(property)}>Edit Details</DropdownMenuItem>
                <DropdownMenuSeparator />
                {property.status !== 'available' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'available')}>Mark Available</DropdownMenuItem>
                )}
                {property.status !== 'occupied' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'occupied')}>Mark Occupied</DropdownMenuItem>
                )}
                {property.status !== 'off_market' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'off_market')}>Take Off Market</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Delete Property
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Monthly rent</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{rent}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            </div>
            <Badge variant="outline" className="rounded-md border-border/70 bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground">
              {propertyType}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/55 pt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Size</p>
              <p className="mt-1 font-medium">{property.square_feet ? `${property.square_feet.toLocaleString()} sqft` : 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Collection</p>
              <p className={cn('mt-1 font-medium', property.status === 'occupied' ? 'text-success' : 'text-muted-foreground')}>
                {property.status === 'occupied' ? 'Active' : 'Setup review'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {property.address}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(property.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

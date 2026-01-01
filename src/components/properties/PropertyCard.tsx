import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Building2, MapPin, Layers, MoreVertical, Edit, Trash2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-success text-success-foreground';
      case 'occupied':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-card transition-smooth group">
        <div className="h-44 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={property.address}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Building2 className="h-12 w-12 text-muted-foreground/30" />
          )}
          <Badge className={`absolute top-3 right-3 ${getStatusColor(property.status)}`}>
            {property.status}
          </Badge>
          {property.photos && property.photos.length > 1 && (
            <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
              +{property.photos.length - 1} photos
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-serif text-xl">${Number(property.rent_amount).toLocaleString()}/mo</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(property)}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {property.status !== 'available' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'available')}>
                    <Eye className="h-4 w-4 mr-2" /> Mark Available
                  </DropdownMenuItem>
                )}
                {property.status !== 'occupied' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'occupied')}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Mark Occupied
                  </DropdownMenuItem>
                )}
                {property.status !== 'off_market' && (
                  <DropdownMenuItem onClick={() => onStatusChange(property.id, 'off_market')}>
                    <EyeOff className="h-4 w-4 mr-2" /> Take Off Market
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Property
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
            <MapPin className="h-3 w-3" /> {property.address}, {property.city}
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {property.square_feet && (
              <span className="flex items-center gap-1">
                <Layers className="h-4 w-4" /> {property.square_feet.toLocaleString()} sqft
              </span>
            )}
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Commercial
            </span>
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

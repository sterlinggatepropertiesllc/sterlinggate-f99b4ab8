import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from './ImageUploader';
import { usePropertyImages } from '@/hooks/usePropertyImages';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

interface EditPropertyDialogProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Property>) => void;
  saving?: boolean;
}

export function EditPropertyDialog({ property, open, onOpenChange, onSave, saving }: EditPropertyDialogProps) {
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip_code: '',
    rent_amount: '',
    square_feet: '',
    description: '',
    status: 'available' as 'available' | 'occupied' | 'off_market',
  });
  const [propertyImages, setPropertyImages] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const { uploadImages, uploading, maxImages, deleteImage } = usePropertyImages();

  useEffect(() => {
    if (property) {
      setFormData({
        address: property.address,
        city: property.city,
        state: property.state,
        zip_code: property.zip_code,
        rent_amount: String(property.rent_amount),
        square_feet: property.square_feet ? String(property.square_feet) : '',
        description: property.description || '',
        status: property.status,
      });
      setPropertyImages(property.photos || []);
      setPendingImageFiles([]);
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;

    let finalPhotos = [...propertyImages];

    // Upload new images if any
    if (pendingImageFiles.length > 0) {
      const uploadedUrls = await uploadImages(pendingImageFiles, property.id);
      // Replace blob URLs with actual uploaded URLs
      const blobUrls = pendingImageFiles.map(f => URL.createObjectURL(f));
      finalPhotos = propertyImages.map(img => {
        const blobIndex = blobUrls.findIndex(b => img.startsWith('blob:'));
        if (blobIndex !== -1 && uploadedUrls[blobIndex]) {
          return uploadedUrls[blobIndex];
        }
        return img;
      });
      // Add remaining uploaded URLs
      finalPhotos = finalPhotos.filter(img => !img.startsWith('blob:'));
      finalPhotos = [...finalPhotos, ...uploadedUrls];
    }

    // Filter out blob URLs from final photos
    finalPhotos = finalPhotos.filter(img => !img.startsWith('blob:'));

    onSave(property.id, {
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip_code: formData.zip_code,
      rent_amount: parseFloat(formData.rent_amount),
      square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
      description: formData.description || null,
      status: formData.status,
      photos: finalPhotos.length > 0 ? finalPhotos : null,
    });
  };

  const handleFilesSelect = (files: File[]) => {
    setPendingImageFiles(prev => [...prev, ...files].slice(0, maxImages - propertyImages.length));
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPropertyImages(prev => [...prev, ...newPreviews].slice(0, maxImages));
  };

  const handleImagesChange = async (newImages: string[]) => {
    // Find removed images that are actual URLs (not blobs)
    const removedImages = propertyImages.filter(
      img => !newImages.includes(img) && !img.startsWith('blob:')
    );

    // Delete removed images from storage
    for (const imageUrl of removedImages) {
      await deleteImage(imageUrl);
    }

    // Update pending files if blob URLs were removed
    const removedBlobIndexes = propertyImages
      .map((img, idx) => (!newImages.includes(img) && img.startsWith('blob:')) ? idx : -1)
      .filter(idx => idx !== -1);

    if (removedBlobIndexes.length > 0) {
      const existingImageCount = property?.photos?.length || 0;
      setPendingImageFiles(prev =>
        prev.filter((_, idx) => !removedBlobIndexes.includes(idx + existingImageCount))
      );
    }

    setPropertyImages(newImages);
  };

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-serif text-2xl">Edit Property</DialogTitle>
          <DialogDescription>Update property details below.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto pr-4">
            <div className="grid grid-cols-2 gap-4 pb-4">
              <div className="col-span-2">
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-zip">ZIP Code</Label>
                <Input
                  id="edit-zip"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-rent">Monthly Rent ($)</Label>
                <Input
                  id="edit-rent"
                  type="number"
                  value={formData.rent_amount}
                  onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-sqft">Square Feet (optional)</Label>
                <Input
                  id="edit-sqft"
                  type="number"
                  value={formData.square_feet}
                  onChange={(e) => setFormData({ ...formData, square_feet: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'available' | 'occupied' | 'off_market') =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="off_market">Off Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Modern commercial space..."
                />
              </div>
              <div className="col-span-2">
                <Label>Property Photos (up to {maxImages})</Label>
                <ImageUploader
                  images={propertyImages}
                  onImagesChange={handleImagesChange}
                  onFilesSelect={handleFilesSelect}
                  maxImages={maxImages}
                  uploading={uploading}
                />
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 pt-4 border-t border-border mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving || uploading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

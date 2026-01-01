import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAvailableProperties } from '@/hooks/useProperties';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageGallery } from '@/components/properties/ImageGallery';
import { 
  Building2, 
  MapPin, 
  ArrowLeft, 
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import logo from '@/assets/logo.jpg';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

export default function Properties() {
  const { data: properties, isLoading } = useAvailableProperties();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const handleApply = (propertyId: string) => {
    if (user) {
      // User is logged in, navigate to application (tenant portal)
      navigate(`/tenant?apply=${propertyId}`);
    } else {
      // User not logged in, redirect to auth with return URL
      navigate(`/auth?redirect=/properties&action=apply&propertyId=${propertyId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={logo} alt="Sterling Gate Properties" className="h-8 w-auto object-contain" />
              <span className="text-lg font-serif font-medium text-foreground tracking-tight hidden sm:block">Sterling Gate</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            {!user && (
              <Link to="/auth">
                <Button className="btn-platinum">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-border" />
              <span className="text-muted-foreground font-medium tracking-widest uppercase text-xs">Available Properties</span>
              <div className="h-px w-12 bg-border" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif mb-6">
              Explore Commercial Spaces
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Browse our curated selection of premium commercial properties. View photos, details, and apply when you're ready.
            </p>
          </div>
        </div>
      </section>

      {/* Properties Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse silver-border bg-card">
                  <div className="h-56 bg-secondary" />
                  <CardContent className="p-6">
                    <div className="h-8 bg-secondary rounded w-1/2 mb-4" />
                    <div className="h-5 bg-secondary rounded w-3/4 mb-4" />
                    <div className="h-5 bg-secondary rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : properties && properties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <Card 
                  key={property.id} 
                  className="overflow-hidden hover-lift group silver-border bg-card cursor-pointer"
                  onClick={() => setSelectedProperty(property)}
                >
                  <div className="h-56 bg-secondary flex items-center justify-center relative overflow-hidden">
                    {property.photos && property.photos.length > 0 ? (
                      <>
                        <img 
                          src={property.photos[0]} 
                          alt={`${property.address}`}
                          className="w-full h-full object-cover image-zoom"
                        />
                        {property.photos.length > 1 && (
                          <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                            +{property.photos.length - 1} photos
                          </div>
                        )}
                      </>
                    ) : (
                      <Building2 className="h-16 w-16 text-muted-foreground/20 image-zoom" />
                    )}
                    <Badge className="absolute top-4 right-4 bg-success/90 text-success-foreground border-0">
                      Available
                    </Badge>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-serif text-2xl">
                        ${Number(property.rent_amount).toLocaleString()}
                        <span className="text-base text-muted-foreground">/mo</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate text-sm">{property.address}, {property.city}</span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6">
                      {property.square_feet && (
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-4 w-4" />
                          {property.square_feet.toLocaleString()} sqft
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Commercial
                      </span>
                    </div>
                    <Button 
                      className="w-full h-11 btn-platinum"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(property.id);
                      }}
                    >
                      Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-16 text-center border-dashed silver-border bg-transparent">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/20 mb-6" />
              <h3 className="text-2xl font-serif mb-3">No Properties Available</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Commercial spaces will appear here once added to the platform.
              </p>
              <Link to="/">
                <Button variant="outline" size="lg" className="btn-outline-silver">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </section>

      {/* Property Detail Modal */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {selectedProperty.address}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Image Gallery */}
                <ImageGallery images={selectedProperty.photos || []} />
                
                {/* Property Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Monthly Rent</h4>
                      <p className="text-3xl font-serif">
                        ${Number(selectedProperty.rent_amount).toLocaleString()}
                        <span className="text-base text-muted-foreground">/mo</span>
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}
                      </p>
                    </div>
                    
                    {selectedProperty.square_feet && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Size</h4>
                        <p className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          {selectedProperty.square_feet.toLocaleString()} sq ft
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {selectedProperty.property_type && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Property Type</h4>
                        <Badge variant="secondary" className="capitalize">
                          {selectedProperty.property_type}
                        </Badge>
                      </div>
                    )}
                    
                    {selectedProperty.amenities && selectedProperty.amenities.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Amenities</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedProperty.amenities.map((amenity, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedProperty.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                    <p className="text-muted-foreground leading-relaxed">{selectedProperty.description}</p>
                  </div>
                )}
                
                {/* Apply Button */}
                <div className="pt-4 border-t border-border">
                  <Button 
                    size="lg" 
                    className="w-full h-14 btn-platinum"
                    onClick={() => handleApply(selectedProperty.id)}
                  >
                    Apply for this Property <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  {!user && (
                    <p className="text-center text-sm text-muted-foreground mt-3">
                      You'll need to sign in or create an account to apply
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

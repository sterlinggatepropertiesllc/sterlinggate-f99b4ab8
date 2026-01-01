import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableProperties } from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Shield, 
  FileText, 
  MessageSquare, 
  ArrowRight, 
  Bed, 
  Bath, 
  MapPin,
  CheckCircle2,
  Users,
  Key,
  LogOut
} from 'lucide-react';

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const { data: properties, isLoading: propertiesLoading } = useAvailableProperties();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center hero-gradient">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading PropertyFlow Pro...</p>
        </div>
      </div>
    );
  }

  // Redirect based on role if logged in
  if (user && role === 'property_manager') {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <Card className="p-8 text-center shadow-elevated max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-serif mb-2">Welcome back!</h2>
          <p className="text-muted-foreground mb-8">Access your property management dashboard</p>
          <div className="space-y-3">
            <Link to="/dashboard" className="block">
              <Button size="lg" className="w-full">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => signOut()} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (user && role === 'tenant') {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <Card className="p-8 text-center shadow-elevated max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key className="h-8 w-8 text-accent-foreground" />
          </div>
          <h2 className="text-3xl font-serif mb-2">Welcome back!</h2>
          <p className="text-muted-foreground mb-8">Access your tenant portal</p>
          <div className="space-y-3">
            <Link to="/tenant" className="block">
              <Button size="lg" className="w-full">
                Go to Tenant Portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => signOut()} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="hero-gradient relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        
        <nav className="container mx-auto px-4 py-6 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-soft">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-serif font-semibold tracking-tight">PropertyFlow Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:flex">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="shadow-soft">Get Started</Button>
            </Link>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-20 md:py-32 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium animate-fade-in">
            ✨ Premium Property Management
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-medium mb-6 animate-fade-in leading-tight">
            Effortless Property<br />
            <span className="text-primary">Management</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up leading-relaxed">
            Streamline applications, digital leases, secure document handling, and seamless communication — all in one elegant platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-base shadow-soft">
                Tenant Portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Property Manager Login
              </Button>
            </Link>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground animate-slide-up">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" /> Bank-level encryption
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" /> Digital signatures
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> 10,000+ properties managed
            </span>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-serif mb-4">Why PropertyFlow Pro?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything you need to manage properties professionally, all in one place.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              { 
                icon: Shield, 
                title: 'Secure Documents', 
                desc: 'Bank-level encryption for sensitive documents like SSN, driver\'s license, and financial records. Your data is always protected.' 
              },
              { 
                icon: FileText, 
                title: 'Digital Leases', 
                desc: 'Full e-signature system with hash ID verification, timestamps, and complete audit trails. Legally binding and paperless.' 
              },
              { 
                icon: MessageSquare, 
                title: 'Internal Messaging', 
                desc: 'Direct communication between tenants and property managers. Never miss an important message with real-time notifications.' 
              },
            ].map((feature, i) => (
              <Card 
                key={i} 
                className="p-8 text-center hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-xl font-serif mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Process</Badge>
            <h2 className="text-3xl md:text-4xl font-serif mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Simple, streamlined, and completely digital from start to finish.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Browse Properties', desc: 'Explore available rentals with detailed photos and information' },
              { step: '02', title: 'Submit Application', desc: 'Complete your application with secure document uploads' },
              { step: '03', title: 'Get Approved', desc: 'Property managers review and approve qualified applicants' },
              { step: '04', title: 'Sign & Move In', desc: 'Sign your lease digitally and get ready to move in' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-serif font-semibold text-primary">{item.step}</span>
                </div>
                <h3 className="font-serif text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Properties */}
      <section className="py-20 md:py-28 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Listings</Badge>
            <h2 className="text-3xl md:text-4xl font-serif mb-4">Available Properties</h2>
            <p className="text-muted-foreground">Explore our current rental listings</p>
          </div>
          
          {propertiesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted rounded w-1/2 mb-3" />
                    <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : properties && properties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.slice(0, 6).map((property) => (
                <Card key={property.id} className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 group">
                  <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                    <Building2 className="h-16 w-16 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-300" />
                    <Badge className="absolute top-4 right-4 bg-success text-success-foreground">Available</Badge>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-serif text-2xl">${Number(property.rent_amount).toLocaleString()}<span className="text-base text-muted-foreground">/mo</span></h3>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-3">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{property.address}, {property.city}, {property.state}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Bed className="h-4 w-4" /> {property.bedrooms} bed
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="h-4 w-4" /> {property.bathrooms} bath
                      </span>
                      {property.square_feet && (
                        <span>{property.square_feet.toLocaleString()} sqft</span>
                      )}
                    </div>
                    <Link to="/auth">
                      <Button className="w-full">Apply Now</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-serif mb-2">No Properties Listed Yet</h3>
              <p className="text-muted-foreground mb-6">Properties will appear here once managers add them to the platform.</p>
              <Link to="/auth">
                <Button variant="outline">
                  Sign in as Property Manager <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <Card className="p-12 md:p-16 text-center bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-serif mb-4">Ready to Get Started?</h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8 text-lg">
                Join thousands of property managers and tenants who trust PropertyFlow Pro for seamless property management.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="h-12 px-8">
                    Create Free Account
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-12 px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar text-sidebar-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <span className="text-xl font-serif">PropertyFlow Pro</span>
            </div>
            <p className="text-sidebar-foreground/60 text-sm">
              © 2026 PropertyFlow Pro. Premium property management, simplified.
            </p>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sidebar-primary" />
              <span className="text-sm text-sidebar-foreground/60">Secure & Encrypted</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

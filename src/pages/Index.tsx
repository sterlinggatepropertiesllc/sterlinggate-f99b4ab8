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
  LogOut,
  ChevronDown,
  Star,
  Clock,
  Sparkles
} from 'lucide-react';

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const { data: properties, isLoading: propertiesLoading } = useAvailableProperties();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
            <Building2 className="h-10 w-10 text-accent-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on role if logged in
  if (user && role === 'property_manager') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 text-center shadow-elevated max-w-md w-full animate-scale-in border-0">
          <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-8 glow-accent">
            <Building2 className="h-10 w-10 text-accent-foreground" />
          </div>
          <h2 className="text-4xl font-serif mb-3">Welcome back</h2>
          <p className="text-muted-foreground mb-10 text-lg">Access your property management dashboard</p>
          <div className="space-y-4">
            <Link to="/dashboard" className="block">
              <Button size="lg" className="w-full h-14 text-base glow-button">
                Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => signOut()} className="w-full h-12">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (user && role === 'tenant') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 text-center shadow-elevated max-w-md w-full animate-scale-in border-0">
          <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-8 glow-accent">
            <Key className="h-10 w-10 text-accent-foreground" />
          </div>
          <h2 className="text-4xl font-serif mb-3">Welcome back</h2>
          <p className="text-muted-foreground mb-10 text-lg">Access your tenant portal</p>
          <div className="space-y-4">
            <Link to="/tenant" className="block">
              <Button size="lg" className="w-full h-14 text-base glow-button">
                Go to Tenant Portal <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => signOut()} className="w-full h-12">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full viewport with background image */}
      <header className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background Image with Ken Burns effect */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80" 
            alt="Luxury home interior"
            className="w-full h-full object-cover animate-ken-burns"
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        {/* Decorative floating elements */}
        <div className="absolute top-1/4 right-[15%] w-32 h-32 bg-accent/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/3 left-[10%] w-48 h-48 bg-accent/5 rounded-full blur-3xl animate-float-delayed" />
        
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between relative z-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shadow-glow">
              <Building2 className="h-6 w-6 text-accent-foreground" />
            </div>
            <span className="text-2xl font-serif font-medium text-white tracking-tight">PropertyFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hidden sm:flex text-white/90 hover:text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center relative z-10">
          <div className="container mx-auto px-6 py-20">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-8 animate-fade-in">
                <Sparkles className="h-5 w-5 text-accent" />
                <span className="text-accent font-medium tracking-wide uppercase text-sm">Where Living Begins</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-medium text-white mb-8 leading-[1.1] animate-slide-up">
                Find Your
                <br />
                <span className="text-gradient-gold">Next Home</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/70 max-w-xl mb-12 animate-slide-up-delay-1 leading-relaxed">
                Streamlined applications, digital leases, and seamless communication — all in one elegant platform.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start gap-4 animate-slide-up-delay-2">
                <Link to="/auth">
                  <Button size="lg" className="h-14 px-10 text-lg bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow glow-button">
                    Start Your Search <ArrowRight className="ml-3 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-white/30 text-white hover:bg-white/10 hover:border-white/50">
                    I'm a Property Manager
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="relative z-10 border-t border-white/10">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-fade-in-delay-3">
              {[
                { value: '10K+', label: 'Properties Managed' },
                { value: '98%', label: 'Satisfaction Rate' },
                { value: '24/7', label: 'Support Available' },
                { value: '50+', label: 'Cities Covered' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-serif text-white mb-1">{stat.value}</div>
                  <div className="text-white/50 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce-subtle">
          <ChevronDown className="h-8 w-8 text-white/50" />
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-accent font-medium tracking-wide uppercase text-sm">Why Choose Us</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mt-4 mb-6">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              Property management reimagined with modern tools and thoughtful design.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              { 
                icon: Shield, 
                title: 'Secure Documents', 
                desc: 'Bank-level encryption for all sensitive documents. SSN, licenses, and financial records protected with enterprise security.' 
              },
              { 
                icon: FileText, 
                title: 'Digital Leases', 
                desc: 'Complete e-signature system with hash verification and audit trails. Legally binding, paperless, and instant.' 
              },
              { 
                icon: MessageSquare, 
                title: 'Direct Messaging', 
                desc: 'Real-time communication between tenants and managers. Important updates delivered instantly.' 
              },
            ].map((feature, i) => (
              <div 
                key={i} 
                className="group p-8 md:p-10 rounded-2xl bg-card hover:shadow-elevated transition-all duration-500 hover:-translate-y-2 border border-border/50"
              >
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-accent/20 transition-colors duration-300">
                  <feature.icon className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-2xl font-serif mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32 bg-secondary/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-accent font-medium tracking-wide uppercase text-sm">Simple Process</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mt-4 mb-6">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              From search to move-in, completely digital.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 md:gap-6 relative">
            {/* Connection line - hidden on mobile */}
            <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-0.5 bg-border" />
            
            {[
              { step: '01', title: 'Browse', desc: 'Explore available properties with photos and details', icon: Building2 },
              { step: '02', title: 'Apply', desc: 'Submit your application with secure uploads', icon: FileText },
              { step: '03', title: 'Approve', desc: 'Quick review and approval process', icon: CheckCircle2 },
              { step: '04', title: 'Move In', desc: 'Sign digitally and get your keys', icon: Key },
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-card border-2 border-accent flex items-center justify-center mx-auto mb-6 relative z-10 shadow-soft">
                  <item.icon className="h-7 w-7 text-accent" />
                </div>
                <span className="text-accent font-serif text-lg mb-2 block">{item.step}</span>
                <h3 className="font-serif text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Properties */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
            <div>
              <span className="text-accent font-medium tracking-wide uppercase text-sm">Featured Listings</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mt-4">
                Available Now
              </h2>
            </div>
            <Link to="/auth">
              <Button variant="outline" size="lg" className="animated-underline">
                View All Properties <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {propertiesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse border-0 shadow-card">
                  <div className="h-64 bg-muted" />
                  <CardContent className="p-8">
                    <div className="h-8 bg-muted rounded w-1/2 mb-4" />
                    <div className="h-5 bg-muted rounded w-3/4 mb-4" />
                    <div className="h-5 bg-muted rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : properties && properties.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.slice(0, 6).map((property) => (
                <Card key={property.id} className="overflow-hidden hover-lift group border-0 shadow-card">
                  <div className="h-64 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                    <Building2 className="h-20 w-20 text-muted-foreground/20 image-zoom" />
                    <Badge className="absolute top-5 right-5 bg-success text-success-foreground px-3 py-1">
                      Available
                    </Badge>
                  </div>
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-serif text-3xl">
                        ${Number(property.rent_amount).toLocaleString()}
                        <span className="text-lg text-muted-foreground">/mo</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{property.address}, {property.city}</span>
                    </div>
                    <div className="flex items-center gap-6 text-muted-foreground mb-6">
                      <span className="flex items-center gap-2">
                        <Bed className="h-4 w-4" /> {property.bedrooms} bed
                      </span>
                      <span className="flex items-center gap-2">
                        <Bath className="h-4 w-4" /> {property.bathrooms} bath
                      </span>
                      {property.square_feet && (
                        <span>{property.square_feet.toLocaleString()} sqft</span>
                      )}
                    </div>
                    <Link to="/auth">
                      <Button className="w-full h-12 glow-button">Apply Now</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-16 text-center border-dashed border-2 bg-transparent">
              <Building2 className="h-20 w-20 mx-auto text-muted-foreground/20 mb-6" />
              <h3 className="text-2xl font-serif mb-3">No Properties Listed Yet</h3>
              <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
                Properties will appear here once managers add them to the platform.
              </p>
              <Link to="/auth">
                <Button variant="outline" size="lg">
                  Sign in as Property Manager <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </section>

      {/* Testimonial / Trust Section */}
      <section className="py-24 md:py-32 bg-secondary/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center gap-1 mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-6 w-6 text-accent fill-accent" />
              ))}
            </div>
            <blockquote className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight mb-10">
              "PropertyFlow transformed how we manage our properties. Everything is seamless, from applications to lease signing."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div className="text-left">
                <div className="font-medium text-lg">Sarah Mitchell</div>
                <div className="text-muted-foreground">Property Manager, 50+ Units</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <Card className="p-12 md:p-20 text-center bg-primary text-primary-foreground overflow-hidden relative border-0">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mb-6">Ready to Get Started?</h2>
              <p className="text-primary-foreground/70 max-w-2xl mx-auto mb-12 text-xl leading-relaxed">
                Join thousands of property managers and tenants who trust PropertyFlow for seamless property management.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link to="/auth">
                  <Button size="lg" className="h-14 px-10 text-lg bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow">
                    Create Free Account
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar text-sidebar-foreground py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sidebar-primary rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <span className="text-2xl font-serif">PropertyFlow</span>
            </div>
            <p className="text-sidebar-foreground/50 text-center md:text-left">
              © 2026 PropertyFlow. Modern property management, simplified.
            </p>
            <div className="flex items-center gap-3 text-sidebar-foreground/50">
              <Shield className="h-5 w-5 text-sidebar-primary" />
              <span>Bank-Level Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

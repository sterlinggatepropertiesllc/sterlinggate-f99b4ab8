import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
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
  MapPin,
  CheckCircle2,
  Users,
  Key,
  LogOut,
  ChevronDown,
  Star,
  BarChart3,
  Layers,
  Clock
} from 'lucide-react';
import logo from '@/assets/logo.png';

export default function Index() {
  const { user, role, loading, signOut } = useAuth();
  const { data: properties, isLoading: propertiesLoading } = useAvailableProperties();
  const navigate = useNavigate();


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border border-primary/30 rounded-lg flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on role if logged in
  if (user && role === 'property_manager') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 text-center max-w-md w-full animate-scale-in silver-border bg-card">
          <div className="w-16 h-16 border border-primary/30 rounded-lg flex items-center justify-center mx-auto mb-8">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-serif mb-3">Welcome back</h2>
          <p className="text-muted-foreground mb-10">Access your property management dashboard</p>
          <div className="space-y-4">
            <Link to="/dashboard" className="block">
              <Button size="lg" className="w-full h-14 btn-platinum">
                Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => signOut()} className="w-full h-12 text-muted-foreground hover:text-foreground">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full viewport with commercial building background */}
      <header className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background Image - Commercial building at night */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=80" 
            alt="Modern commercial building"
            className="w-full h-full object-cover animate-ken-burns"
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>
        
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between relative z-20">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Sterling Gate Properties" className="h-14 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4">
            {user && role === 'property_manager' ? (
              <Link to="/dashboard">
                <Button className="btn-platinum">
                  Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : user && role === 'tenant' ? (
              <>
                <Link to="/tenant">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                    Tenant Portal
                  </Button>
                </Link>
                <Button variant="ghost" onClick={() => signOut()} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" className="hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-secondary">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="btn-platinum">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center relative z-10">
          <div className="container mx-auto px-6 py-20">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-8 animate-fade-in">
                <div className="h-px w-12 bg-primary/50" />
                <span className="text-primary font-medium tracking-widest uppercase text-xs">Commercial Real Estate</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-medium text-foreground mb-8 leading-[1.1] animate-slide-up">
                Sterling Gate
                <br />
                <span className="text-primary">Properties</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-12 animate-slide-up-delay-1 leading-relaxed">
                Sophisticated commercial property management. Streamlined leasing, digital documentation, and seamless portfolio oversight.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start gap-4 animate-slide-up-delay-2">
                <Link to="/properties">
                  <Button size="lg" className="h-14 px-10 text-base btn-platinum">
                    Explore Properties <ArrowRight className="ml-3 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="relative z-10 border-t border-border/30">
          <div className="container mx-auto px-6 py-8">
            <div className="flex flex-wrap items-center justify-center md:justify-between gap-8 animate-fade-in-delay-3">
              {[
                { value: '2.5M+', label: 'Sq Ft Managed' },
                { value: '150+', label: 'Commercial Properties' },
                { value: '98%', label: 'Client Retention' },
                { value: '24/7', label: 'Support' },
              ].map((stat, i) => (
                <div key={i} className="text-center flex items-center gap-8">
                  <div>
                    <div className="text-3xl md:text-4xl font-serif text-foreground mb-1">{stat.value}</div>
                    <div className="text-muted-foreground text-sm tracking-wide">{stat.label}</div>
                  </div>
                  {i < 3 && <div className="hidden md:block silver-divider" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce-subtle">
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-border" />
              <span className="text-muted-foreground font-medium tracking-widest uppercase text-xs">Platform</span>
              <div className="h-px w-12 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">
              Built for Commercial
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              Enterprise-grade tools designed specifically for commercial property management.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: Shield, 
                title: 'Secure Documentation', 
                desc: 'Bank-level encryption for sensitive commercial documents. Contracts, leases, and financial records fully protected.' 
              },
              { 
                icon: FileText, 
                title: 'Digital Lease Management', 
                desc: 'Complete e-signature system with audit trails and hash verification. Legally binding, paperless, instant.' 
              },
              { 
                icon: MessageSquare, 
                title: 'Tenant Communication', 
                desc: 'Centralized messaging for all commercial tenants. Important updates and maintenance requests in one place.' 
              },
            ].map((feature, i) => (
              <div 
                key={i} 
                className="group p-8 rounded-lg bg-card silver-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 border border-border rounded-lg flex items-center justify-center mb-6 group-hover:border-primary/40 transition-colors duration-300">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-serif mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-border" />
              <span className="text-muted-foreground font-medium tracking-widest uppercase text-xs">Process</span>
              <div className="h-px w-12 bg-border" />
            </div>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              From property listing to lease execution, fully digital.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 md:gap-4 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-10 left-[15%] right-[15%] h-px bg-border" />
            
            {[
              { step: '01', title: 'List', desc: 'Add commercial properties to your portfolio', icon: Building2 },
              { step: '02', title: 'Review', desc: 'Evaluate tenant applications efficiently', icon: FileText },
              { step: '03', title: 'Approve', desc: 'Streamlined approval workflow', icon: CheckCircle2 },
              { step: '04', title: 'Execute', desc: 'Digital lease signing and onboarding', icon: Key },
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="w-20 h-20 rounded-lg bg-card border border-border flex items-center justify-center mx-auto mb-6 relative z-10">
                  <item.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="text-primary font-serif text-sm mb-2 block tracking-wider">{item.step}</span>
                <h3 className="font-serif text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
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
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-12 bg-border" />
                <span className="text-muted-foreground font-medium tracking-widest uppercase text-xs">Portfolio</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif">
                Featured Spaces
              </h2>
            </div>
            <Link to="/properties">
              <Button variant="outline" size="lg" className="btn-outline-silver">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {propertiesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
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
              {properties.slice(0, 6).map((property) => (
                <Card key={property.id} className="overflow-hidden hover-lift group silver-border bg-card">
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
                    <Link to="/properties">
                      <Button className="w-full h-11 btn-platinum">View Details</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-16 text-center border-dashed silver-border bg-transparent">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/20 mb-6" />
              <h3 className="text-2xl font-serif mb-3">No Properties Listed</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Commercial spaces will appear here soon. Check back later for available listings.
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 md:py-32 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center gap-1 mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-5 w-5 text-primary fill-primary" />
              ))}
            </div>
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-serif leading-tight mb-10">
              "Sterling Gate transformed how we manage our commercial portfolio. The digital lease system alone saved us countless hours."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">Michael Chen</div>
                <div className="text-muted-foreground text-sm">Portfolio Manager, 85+ Commercial Units</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Sterling Gate */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px w-12 bg-border" />
                <span className="text-muted-foreground font-medium tracking-widest uppercase text-xs">Why Us</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif mb-6">
                Built for Scale
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-10">
                Whether you manage a single building or an entire portfolio, Sterling Gate provides the tools you need to operate efficiently.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: BarChart3, title: 'Portfolio Analytics', desc: 'Real-time insights across all properties' },
                  { icon: Clock, title: 'Time Savings', desc: 'Automate repetitive management tasks' },
                  { icon: Shield, title: 'Enterprise Security', desc: 'Bank-grade protection for all data' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 border border-border rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg mb-1">{item.title}</h4>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-[4/3] rounded-lg overflow-hidden silver-border">
                <img 
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80" 
                  alt="Modern office interior"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-8 -left-8 bg-card silver-border rounded-lg p-6 shadow-elevated max-w-xs">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div className="font-serif text-lg">Trusted Platform</div>
                </div>
                <p className="text-muted-foreground text-sm">Managing over 2.5 million square feet of commercial space</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1464938050520-ef2571e0a0f2?auto=format&fit=crop&w=2000&q=80" 
            alt="City skyline"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-serif mb-6 text-foreground">
              Elevate Your Portfolio
            </h2>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              Find your perfect commercial space with Sterling Gate's streamlined application process.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="h-14 px-12 text-base btn-platinum">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-14 px-12 text-base btn-outline-silver">
                  Schedule Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-background">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Sterling Gate Properties" className="h-12 w-auto object-contain" />
            </div>
            <p className="text-muted-foreground text-sm">
              © 2026 Sterling Gate Properties. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
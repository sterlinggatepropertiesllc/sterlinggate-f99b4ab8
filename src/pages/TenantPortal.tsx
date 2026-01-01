import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Building2, Home } from 'lucide-react';

export default function TenantPortal() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'tenant') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar min-h-screen p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
              <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-serif text-sidebar-foreground">Tenant Portal</span>
          </div>
          <nav className="space-y-2">
            {['Browse Properties', 'My Applications', 'My Leases', 'Documents', 'Messages'].map((item) => (
              <div
                key={item}
                className="px-4 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-smooth"
              >
                {item}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <h1 className="text-3xl font-serif mb-8">Tenant Portal</h1>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'My Applications', value: '0' },
              { label: 'Active Leases', value: '0' },
              { label: 'Unread Messages', value: '0' },
            ].map((stat) => (
              <Card key={stat.label} className="p-6">
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="text-3xl font-serif mt-2">{stat.value}</p>
              </Card>
            ))}
          </div>

          <Card className="p-8 text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-serif mb-2">Welcome to your Portal</h2>
            <p className="text-muted-foreground">Browse available properties and submit applications.</p>
          </Card>
        </main>
      </div>
    </div>
  );
}

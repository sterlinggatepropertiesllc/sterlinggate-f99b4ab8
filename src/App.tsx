import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TelegramProvider } from "@/contexts/TelegramContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppVersion } from "@/hooks/useAppVersion";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TenantPortal = lazy(() => import("./pages/TenantPortal"));
const TenantDetail = lazy(() => import("./pages/TenantDetail"));
const Properties = lazy(() => import("./pages/Properties"));
const SignLease = lazy(() => import("./pages/SignLease"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelled = lazy(() => import("./pages/PaymentCancelled"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading Sterling Gate...
    </div>
  );
}

const AppContent = () => {
  useAppVersion();
  
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard/tenant/:tenantId" element={<TenantDetail />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/tenant/*" element={<TenantPortal />} />
            <Route path="/sign-lease/:id" element={<SignLease />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancelled" element={<PaymentCancelled />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TelegramProvider>
          <AppContent />
        </TelegramProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

import { useEffect } from "react";

const forceHardRefresh = async () => {
  // Clear Cache API
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  
  // Navigate with cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.href = url.toString();
};

export const useAppVersion = () => {
  useEffect(() => {
    const checkAndUpdate = async () => {
      try {
        // Get stored version from sessionStorage
        const storedVersion = sessionStorage.getItem('app_version');
        
        // Fetch current version (bypass cache)
        const response = await fetch('/version.json', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (!storedVersion) {
          // First load - store current version
          sessionStorage.setItem('app_version', data.version);
        } else if (storedVersion !== data.version) {
          // Version mismatch - hard refresh immediately
          sessionStorage.setItem('app_version', data.version);
          forceHardRefresh();
        }
      } catch (e) {
        // Silently fail if version check fails
      }
    };

    checkAndUpdate();
  }, []);
};

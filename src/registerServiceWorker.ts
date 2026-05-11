export async function registerSterlingServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) return null;

  try {
    return await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
}

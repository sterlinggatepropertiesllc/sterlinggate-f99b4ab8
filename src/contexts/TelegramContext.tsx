import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TelegramContextType {
  isTelegram: boolean;
  telegramUser: TelegramUser | null;
  isAuthenticating: boolean;
  authError: string | null;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  telegramUser: null,
  isAuthenticating: false,
  authError: null,
});

function isTelegramWebApp(): boolean {
  try {
    const tg = (window as any).Telegram?.WebApp;
    return !!tg?.initData && tg.initData.length > 0;
  } catch {
    return false;
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[TelegramContext] Initializing...');
    let inTelegram = false;
    try {
      inTelegram = isTelegramWebApp();
    } catch (e) {
      console.warn('[TelegramContext] Error checking Telegram environment:', e);
    }
    setIsTelegram(inTelegram);
    console.log('[TelegramContext] isTelegram:', inTelegram);

    if (!inTelegram) return;

    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      console.warn('[TelegramContext] Telegram.WebApp object not available despite initData check');
      return;
    }

    // --- Safe Telegram API calls ---
    try { tg.ready(); } catch (e) { console.warn('[TG] ready() failed:', e); }
    try { tg.expand(); } catch (e) { console.warn('[TG] expand() failed:', e); }
    try { tg.requestFullscreen?.(); } catch (e) { console.warn('[TG] requestFullscreen() failed:', e); }

    try {
      document.documentElement.classList.add('telegram-webapp');
    } catch (e) { console.warn('[TG] classList add failed:', e); }

    try {
      if ('isVerticalSwipesEnabled' in tg) {
        tg.isVerticalSwipesEnabled = false;
      }
    } catch (e) { console.warn('[TG] disable vertical swipes failed:', e); }

    // Viewport height
    const root = document.documentElement;
    let cleanupViewport: (() => void) | undefined;
    try {
      const updateViewportHeight = () => {
        const stableHeight = tg.viewportStableHeight;
        const currentHeight = tg.viewportHeight;
        if (stableHeight) {
          root.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
        }
        if (currentHeight) {
          root.style.setProperty('--tg-viewport-height', `${currentHeight}px`);
        }
        // Re-read safe area insets on every viewport change
        try {
          const safeArea = tg.safeAreaInset;
          const contentSafeArea = tg.contentSafeAreaInset;
          if (safeArea) {
            root.style.setProperty('--tg-safe-top', `${safeArea.top || 0}px`);
            root.style.setProperty('--tg-safe-bottom', `${safeArea.bottom || 0}px`);
          }
          if (contentSafeArea) {
            root.style.setProperty('--tg-content-safe-top', `${contentSafeArea.top || 0}px`);
            root.style.setProperty('--tg-content-safe-bottom', `${contentSafeArea.bottom || 0}px`);
          }
        } catch (e) { console.warn('[TG] safe area insets update failed:', e); }
      };
      updateViewportHeight();
      tg.onEvent('viewportChanged', updateViewportHeight);
      cleanupViewport = () => {
        try { tg.offEvent('viewportChanged', updateViewportHeight); } catch {}
      };
    } catch (e) { console.warn('[TG] viewport height setup failed:', e); }

    // Theme
    try {
      if (tg.themeParams) {
        if (tg.themeParams.bg_color) {
          root.style.setProperty('--background', hexToHsl(tg.themeParams.bg_color));
        }
        if (tg.themeParams.text_color) {
          root.style.setProperty('--foreground', hexToHsl(tg.themeParams.text_color));
        }
      }
    } catch (e) { console.warn('[TG] theme params failed:', e); }

    // Back button
    let cleanupBackButton: (() => void) | undefined;
    try {
      const updateBackButton = () => {
        try {
          if (window.location.pathname === '/' || window.location.pathname === '') {
            tg.BackButton.hide();
          } else {
            tg.BackButton.show();
          }
        } catch {}
      };

      try { tg.BackButton.onClick(() => { window.history.back(); }); } catch {}
      window.addEventListener('popstate', updateBackButton);
      updateBackButton();
      cleanupBackButton = () => {
        window.removeEventListener('popstate', updateBackButton);
      };
    } catch (e) { console.warn('[TG] back button setup failed:', e); }

    // Auth
    console.log('[TelegramContext] Starting authentication with initData');
    authenticateWithTelegram(tg.initData);

    return () => {
      cleanupViewport?.();
      cleanupBackButton?.();
      try { document.documentElement.classList.remove('telegram-webapp'); } catch {}
    };
  }, []);

  const authenticateWithTelegram = async (initData: string) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Check existing session
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        console.log('[TelegramContext] Existing session found, skipping auth');
        try {
          const params = new URLSearchParams(initData);
          const userStr = params.get('user');
          if (userStr) setTelegramUser(JSON.parse(userStr));
        } catch {}
        setIsAuthenticating(false);
        return;
      }

      console.log('[TelegramContext] Sending auth request...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ initData }),
        }
      );

      console.log('[TelegramContext] Auth response status:', response.status);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Authentication failed');
      }

      const data = await response.json();
      console.log('[TelegramContext] Auth successful, user:', data.telegram_user?.first_name);
      setTelegramUser(data.telegram_user);

      if (data.access_token && data.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          console.error('[TelegramContext] Session set error:', sessionError);
          throw new Error('Failed to establish session');
        }
      } else {
        throw new Error('No session tokens received');
      }
    } catch (err) {
      console.error('[TelegramContext] Auth error:', err);
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Render loading screen during Telegram auth
  if (isTelegram && isAuthenticating) {
    return (
      <TelegramContext.Provider value={{ isTelegram, telegramUser, isAuthenticating, authError }}>
        <div
          style={{
            minHeight: 'var(--tg-viewport-stable-height, 100dvh)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '1.1rem' }}>Loading Sterling Gate...</p>
        </div>
      </TelegramContext.Provider>
    );
  }

  // Render error screen if Telegram auth failed
  if (isTelegram && authError) {
    return (
      <TelegramContext.Provider value={{ isTelegram, telegramUser, isAuthenticating, authError }}>
        <div
          style={{
            minHeight: 'var(--tg-viewport-stable-height, 100dvh)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: '#111',
            color: '#fff',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</p>
          <p style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
            Session expired or authentication failed.
          </p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
            Please reopen the app from Telegram.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.5rem',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </TelegramContext.Provider>
    );
  }

  return (
    <TelegramContext.Provider value={{ isTelegram, telegramUser, isAuthenticating, authError }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

function hexToHsl(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

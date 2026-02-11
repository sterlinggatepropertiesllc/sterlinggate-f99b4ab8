import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
    // Check for Telegram WebApp object
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
    const inTelegram = isTelegramWebApp();
    setIsTelegram(inTelegram);

    if (inTelegram) {
      const tg = (window as any).Telegram.WebApp;
      
      // Tell Telegram the app is ready
      tg.ready();
      
      // Expand to full height
      tg.expand();
      
      // Request fullscreen if available (newer clients)
      tg.requestFullscreen?.();

      // Add telegram-webapp class to html element for global CSS targeting
      document.documentElement.classList.add('telegram-webapp');
      
      // Prevent accidental close on scroll
      if ('isVerticalSwipesEnabled' in tg) {
        tg.isVerticalSwipesEnabled = false;
      }

      // Read Telegram safe area insets and set CSS variables
      const root = document.documentElement;
      
      // tg.safeAreaInset and tg.contentSafeAreaInset available in newer clients
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

      // Apply Telegram theme colors to CSS variables
      if (tg.themeParams) {
        if (tg.themeParams.bg_color) {
          root.style.setProperty('--background', hexToHsl(tg.themeParams.bg_color));
        }
        if (tg.themeParams.text_color) {
          root.style.setProperty('--foreground', hexToHsl(tg.themeParams.text_color));
        }
      }

      // Dynamic back button visibility
      const updateBackButton = () => {
        if (window.location.pathname === '/' || window.location.pathname === '') {
          tg.BackButton.hide();
        } else {
          tg.BackButton.show();
        }
      };

      tg.BackButton.onClick(() => {
        window.history.back();
      });

      window.addEventListener('popstate', updateBackButton);
      updateBackButton();

      // Auto-authenticate
      authenticateWithTelegram(tg.initData);

      return () => {
        window.removeEventListener('popstate', updateBackButton);
        document.documentElement.classList.remove('telegram-webapp');
      };
    }
  }, []);

  const authenticateWithTelegram = async (initData: string) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Check if already logged in
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        // Already authenticated, extract telegram user from initData
        try {
          const params = new URLSearchParams(initData);
          const userStr = params.get('user');
          if (userStr) setTelegramUser(JSON.parse(userStr));
        } catch {}
        setIsAuthenticating(false);
        return;
      }

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

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Authentication failed');
      }

      const data = await response.json();
      setTelegramUser(data.telegram_user);

      // Set the session directly using the tokens from the server
      if (data.access_token && data.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          console.error('Session set error:', sessionError);
          throw new Error('Failed to establish session');
        }
      } else {
        throw new Error('No session tokens received');
      }
    } catch (err) {
      console.error('Telegram auth error:', err);
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <TelegramContext.Provider value={{ isTelegram, telegramUser, isAuthenticating, authError }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

// Helper to convert hex color to HSL string for CSS variables
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

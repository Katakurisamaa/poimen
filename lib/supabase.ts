import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

/**
 * Nettoie complètement la session locale (localStorage & cookies)
 * sans faire d'appel réseau distant si le token est invalide ou révoqué.
 */
export async function clearLocalSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
          localStorage.removeItem(key);
        }
      }

      document.cookie.split(';').forEach((c) => {
        const eqPos = c.indexOf('=');
        const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
        if (name.startsWith('sb-') && name.includes('auth-token')) {
          document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
        }
      });
    } catch {}
  }
}

/**
 * Récupère la session actuelle de manière sécurisée.
 * Si le refresh token est inexistant ou révoqué, il nettoie la session locale
 * sans lever d'exception AuthApiError dans la console.
 */
export async function getSafeSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (
        error.message?.includes('Refresh Token') ||
        (error as any).code === 'refresh_token_not_found' ||
        (error as any).status === 400
      ) {
        await clearLocalSession();
      }
      return null;
    }
    return data?.session || null;
  } catch (err: any) {
    if (
      err?.message?.includes('Refresh Token') ||
      err?.code === 'refresh_token_not_found' ||
      err?.status === 400
    ) {
      await clearLocalSession();
    }
    return null;
  }
}

/**
 * Récupère l'utilisateur actuel de manière sécurisée.
 * Protège contre les erreurs de token expiré ou corrompu.
 */
export async function getSafeUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (
        error.message?.includes('Refresh Token') ||
        (error as any).code === 'refresh_token_not_found' ||
        (error as any).status === 400
      ) {
        await clearLocalSession();
      }
      return null;
    }
    return data?.user || null;
  } catch (err: any) {
    if (
      err?.message?.includes('Refresh Token') ||
      err?.code === 'refresh_token_not_found' ||
      err?.status === 400
    ) {
      await clearLocalSession();
    }
    return null;
  }
}

// Interception côté client pour empêcher Next.js Dev Overlay
// de s'afficher lors d'une expiration de refresh token normale dans GoTrueClient
if (typeof window !== 'undefined') {
  // 1. Filtrer console.error sur l'erreur bénigne Supabase AuthApiError
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const isInvalidRefreshToken = args.some((arg) => {
      if (!arg) return false;
      if (typeof arg === 'string') {
        return (
          arg.includes('Invalid Refresh Token') ||
          arg.includes('refresh_token_not_found') ||
          arg.includes('Auto refresh tick failed')
        );
      }
      if (typeof arg === 'object') {
        const msg = String(arg.message || '');
        const name = String(arg.name || '');
        const code = String(arg.code || '');
        return (
          (name === 'AuthApiError' || name === 'AuthError') &&
          (msg.includes('Invalid Refresh Token') ||
            msg.includes('refresh_token_not_found') ||
            code === 'refresh_token_not_found')
        );
      }
      return false;
    });

    if (isInvalidRefreshToken) {
      console.warn('[Supabase Auth] Session expirée ou refresh token révoqué. Nettoyage de la session locale...');
      clearLocalSession().catch(() => {});
      return;
    }

    originalConsoleError.apply(console, args);
  };

  // 2. Intercepter les rejets de promesses non gérés relatifs au refresh token
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (
      reason &&
      (
        (reason.message && String(reason.message).includes('Invalid Refresh Token')) ||
        reason.code === 'refresh_token_not_found' ||
        (reason.name === 'AuthApiError' && String(reason.message).includes('refresh_token'))
      )
    ) {
      event.preventDefault();
      console.warn('[Supabase Auth] Expiration de token interceptée proprement.');
      clearLocalSession().catch(() => {});
    }
  });
}


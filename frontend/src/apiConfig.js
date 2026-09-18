/**
 * API Configuration
 * In local environment (localhost, 127.0.0.1, LAN): uses relative path '' to communicate directly with local FastAPI server
 * In production deployment (Cloudflare Pages / remote domain): uses the live backend URL on Render
 */
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname === ''
);

export const API_BASE = import.meta.env.VITE_API_URL || (
  isLocal ? '' : (import.meta.env.PROD ? 'https://quizzizforyou.onrender.com' : '')
);

export const apiUrl = (endpoint) => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
};

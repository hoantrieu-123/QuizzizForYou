/**
 * API Configuration
 * In development (local): uses relative paths '' so Vite proxies to localhost:8000
 * In production (Cloudflare): uses the live backend URL on Render
 */
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://quizzizforyou.onrender.com' : '');

export const apiUrl = (endpoint) => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
};


import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../apiConfig';

export const DEFAULT_ADMIN_PIN = '1234';

/**
 * Safely encode any string to ISO-8859-1 / ASCII safe format for HTTP headers.
 * Converts characters outside 0x20-0x7E into URL encoded format so that browser
 * fetch() never throws: "Failed to read the 'headers' property: String contains non ISO-8859-1 code point"
 */
export const toSafeHeaderValue = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  let hasNonAscii = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 32 || code > 126) {
      hasNonAscii = true;
      break;
    }
  }
  if (!hasNonAscii) return str;
  try {
    return encodeURIComponent(str);
  } catch {
    return str.replace(/[^\x20-\x7E]/g, '');
  }
};

export const getAdminPin = () => {
  try {
    const raw = localStorage.getItem('admin_ip_logs_pin');
    if (!raw || !raw.trim()) return DEFAULT_ADMIN_PIN;
    return raw.trim();
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
};

export const setAdminPinInStorage = (pin) => {
  if (pin) {
    try {
      localStorage.setItem('admin_ip_logs_pin', String(pin).trim());
    } catch (e) {
      console.warn('Failed to save admin pin:', e);
    }
  }
  window.dispatchEvent(new Event('admin-auth-changed'));
};

export const isAdminUnlocked = () => {
  return localStorage.getItem('admin_ip_logs_unlocked') === 'true';
};

export const setAdminUnlocked = (unlocked = true) => {
  if (unlocked) {
    localStorage.setItem('admin_ip_logs_unlocked', 'true');
  } else {
    localStorage.removeItem('admin_ip_logs_unlocked');
  }
  window.dispatchEvent(new Event('admin-auth-changed'));
};

export const getAdminHeaders = () => {
  const headers = {};
  const pin = getAdminPin();
  if (pin) {
    headers['X-Admin-PIN'] = toSafeHeaderValue(pin);
  }
  return headers;
};

let cachedClientPermissions = {
  client_ip: '',
  is_super_admin: false,
  is_admin: false,
  can_delete: false,
  super_admin_ips: []
};

let permissionFetchPromise = null;

export const fetchClientPermissions = async (force = false) => {
  if (!force && permissionFetchPromise) {
    return permissionFetchPromise;
  }
  permissionFetchPromise = (async () => {
    try {
      const headers = {};
      if (isAdminUnlocked()) {
        const pin = getAdminPin();
        if (pin) {
          headers['X-Admin-PIN'] = toSafeHeaderValue(pin);
        }
      }
      const res = await fetch(apiUrl('/api/client/permissions'), { headers });
      if (res.ok) {
        const data = await res.json();
        cachedClientPermissions = {
          client_ip: data.client_ip || '',
          is_super_admin: !!data.is_super_admin,
          is_admin: !!data.is_admin || isAdminUnlocked(),
          can_delete: !!data.can_delete || !!data.is_super_admin || isAdminUnlocked(),
          super_admin_ips: data.super_admin_ips || []
        };
        window.dispatchEvent(new CustomEvent('admin-permissions-updated', { detail: cachedClientPermissions }));
        return cachedClientPermissions;
      }
    } catch (e) {
      console.warn('Failed to fetch client permissions:', e);
    }
    return cachedClientPermissions;
  })();

  const result = await permissionFetchPromise;
  permissionFetchPromise = null;
  return result;
};

export const getCachedPermissions = () => cachedClientPermissions;

/**
 * Custom React Hook for reactive permissions and admin status
 */
export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(isAdminUnlocked);
  const [permissions, setPermissions] = useState(cachedClientPermissions);

  const refreshPermissions = useCallback(() => {
    fetchClientPermissions(true).then(setPermissions);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAdmin(isAdminUnlocked());
      fetchClientPermissions(true).then(setPermissions);
    };

    const handlePermUpdate = (e) => {
      if (e.detail) {
        setPermissions(e.detail);
      }
    };

    // Initial fetch
    fetchClientPermissions().then(setPermissions);

    window.addEventListener('admin-auth-changed', handleAuthChange);
    window.addEventListener('admin-permissions-updated', handlePermUpdate);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('admin-auth-changed', handleAuthChange);
      window.removeEventListener('admin-permissions-updated', handlePermUpdate);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const unlock = (pin) => {
    if (pin) setAdminPinInStorage(pin);
    setAdminUnlocked(true);
    refreshPermissions();
  };

  const lock = () => {
    setAdminUnlocked(false);
    refreshPermissions();
  };

  const isSuperAdmin = !!permissions.is_super_admin;
  // User has full delete permission if they are super admin OR have unlocked via Admin PIN
  const canDelete = isSuperAdmin || isAdmin || !!permissions.can_delete;

  // canEdit check: Super admin or unlocked PIN can edit anything.
  // Normal Guest IP can only edit if item was imported by their exact client IP.
  const canEdit = useCallback((item) => {
    if (isSuperAdmin || isAdmin || permissions.can_delete) return true;
    if (!item) return false;
    const createdIp = (item.created_ip || item.createdIp || '').trim();
    const myIp = (permissions.client_ip || '').trim();
    if (!createdIp || !myIp) return false;
    return createdIp === myIp;
  }, [isSuperAdmin, isAdmin, permissions.can_delete, permissions.client_ip]);

  return {
    isAdmin: isSuperAdmin || isAdmin,
    isSuperAdmin,
    canDelete,
    canEdit,
    clientIp: permissions.client_ip,
    superAdminIps: permissions.super_admin_ips,
    pin: getAdminPin(),
    unlock,
    lock,
    refreshPermissions,
    getHeaders: getAdminHeaders
  };
}

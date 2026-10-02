import { useState, useEffect } from 'react';
import { apiUrl } from '../apiConfig';

export const DEFAULT_ADMIN_PIN = '1234';

export const getAdminPin = () => {
  return localStorage.getItem('admin_ip_logs_pin') || DEFAULT_ADMIN_PIN;
};

export const setAdminPinInStorage = (pin) => {
  if (pin) {
    localStorage.setItem('admin_ip_logs_pin', pin.trim());
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
  return {
    'X-Admin-PIN': getAdminPin()
  };
};

/**
 * Custom React Hook to reactive admin status
 */
export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(isAdminUnlocked);

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAdmin(isAdminUnlocked());
    };
    window.addEventListener('admin-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('admin-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const unlock = (pin) => {
    if (pin) setAdminPinInStorage(pin);
    setAdminUnlocked(true);
  };

  const lock = () => {
    setAdminUnlocked(false);
  };

  return {
    isAdmin,
    pin: getAdminPin(),
    unlock,
    lock,
    getHeaders: getAdminHeaders
  };
}

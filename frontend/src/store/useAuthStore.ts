import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { API_URL } from '../constants/config';

const ACCESS_TOKEN_SERVICE = 'accessToken';
const REFRESH_TOKEN_SERVICE = 'refreshToken';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSkipped: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  skipLogin: () => void;
  loadStoredAuth: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,
  isSkipped: false,

  setTokens: (accessToken, refreshToken) => {
    Keychain.setGenericPassword('token', accessToken, { service: ACCESS_TOKEN_SERVICE });
    Keychain.setGenericPassword('token', refreshToken, { service: REFRESH_TOKEN_SERVICE });
    set({ accessToken, refreshToken });
  },

  setUser: (user) => set({ user }),

  login: (user, accessToken, refreshToken) => {
    Keychain.setGenericPassword('token', accessToken, { service: ACCESS_TOKEN_SERVICE });
    Keychain.setGenericPassword('token', refreshToken, { service: REFRESH_TOKEN_SERVICE });
    set({ user, accessToken, refreshToken, isAuthenticated: true, isSkipped: false, isLoading: false });
  },

  logout: () => {
    Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE });
    Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isSkipped: false,
    });
  },

  skipLogin: () => {
    set({ isSkipped: true });
  },

  loadStoredAuth: async () => {
    try {
      const accessCred = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_SERVICE });
      const refreshCred = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_SERVICE });

      if (accessCred && refreshCred) {
        set({ accessToken: accessCred.password, refreshToken: refreshCred.password, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  getValidToken: async (): Promise<string | null> => {
    const state = get();
    const { accessToken, refreshToken, logout } = state;
    if (!accessToken || !refreshToken) {
      console.log('[getValidToken] no tokens');
      return null;
    }

    // Try to decode JWT expiry (handle base64url)
    let expMs: number | null = null;
    try {
      const parts = accessToken.split('.');
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(b64);
      expMs = JSON.parse(raw).exp * 1000;
    } catch (e) {
      console.log('[getValidToken] decode failed:', e);
    }

    if (expMs && expMs > Date.now() + 60000) {
      return accessToken;
    }

    // Token expired or about to expire — try to refresh
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
      const { accessToken: newAccess, refreshToken: newRefresh } = data;
      Keychain.setGenericPassword('token', newAccess, { service: ACCESS_TOKEN_SERVICE });
      Keychain.setGenericPassword('token', newRefresh, { service: REFRESH_TOKEN_SERVICE });
      set({ accessToken: newAccess, refreshToken: newRefresh });
      return newAccess;
    } catch (refreshErr: any) {
      console.log('[getValidToken] refresh failed:', refreshErr?.message || refreshErr);
      logout();
      return null;
    }
  },
}));

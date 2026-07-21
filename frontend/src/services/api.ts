import axios, { type AxiosInstance } from 'axios';
import { API_URL } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';

// Shared auth interceptors for any axios instance
function addAuthInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[api]', config.method?.toUpperCase(), config.baseURL + config.url);
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        error.response?.data?.code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (!refreshToken) {
          logout();
          return Promise.reject(error);
        }

        try {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          setTokens(data.accessToken, data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return instance(originalRequest);
        } catch {
          logout();
        }
      }

      return Promise.reject(error);
    }
  );
}

// Default instance — 30s timeout covers most endpoints including stream URL resolution
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000, // was 15s — too tight for yt-dlp operations
  headers: { 'Content-Type': 'application/json' },
});

// Dedicated search instance — yt-dlp YouTube search takes up to 20s on cold cache
export const searchApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
});

addAuthInterceptors(api);
addAuthInterceptors(searchApi);

export default api;

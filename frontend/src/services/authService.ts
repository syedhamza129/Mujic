import api from './api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export const authService = {
  async login(payload: LoginPayload) {
    const { data } = await api.post('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterPayload) {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },

  async logout(refreshToken: string) {
    await api.post('/auth/logout', { refreshToken });
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};

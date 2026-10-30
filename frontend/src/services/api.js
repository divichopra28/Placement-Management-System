import axios from 'axios';

// All requests go to the Express backend (proxied by Vite in development).
// The session lives in an httpOnly cookie, so no token is handled in JS.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/me')) {
      window.dispatchEvent(new CustomEvent('pms:unauthorized'));
    }
    return Promise.reject(err);
  },
);

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return fallback;
}

export function fieldErrors(err) {
  return err?.response?.data?.details?.fields || {};
}

export default api;

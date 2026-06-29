import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    // Check if token in URL hash/query (from OIDC redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('token');
    
    // Set default axios headers
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Set up interceptor to catch 401s or 403 setup required
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.data?.setupRequired) {
          setSetupRequired(true);
        } else if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Initial check
    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/auth/setup-check');
        if (res.data.setupRequired) {
          setSetupRequired(true);
          setLoading(false);
          return;
        }

        if (token) {
          const verifyRes = await axios.get('/api/auth/verify');
          if (verifyRes.data.valid) {
            setUser(verifyRes.data.user);
          } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      setUser(res.data.user);
      return true;
    }
    return false;
  };

  const setup = async (username, password) => {
    const res = await axios.post('/api/auth/setup', { username, password });
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      setUser(res.data.user);
      setSetupRequired(false);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, login, setup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

import { createContext, useContext, useState } from 'react';

const API = process.env.API;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ts_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ts_token'));

  function persist(token, user) {
    localStorage.setItem('ts_token', token);
    localStorage.setItem('ts_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  }

  async function register(name, email, password, role) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    persist(data.token, data.user);
  }

  async function login(email, password) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    persist(data.token, data.user);
  }

  function logout() {
    localStorage.removeItem('ts_token');
    localStorage.removeItem('ts_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { API };

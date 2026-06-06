import { createContext, useContext, useState } from 'react';
import { refreshSession, clearSession } from '../api/glpiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      await refreshSession(username, password);
      setIsConnected(true);
      return true;
    } catch (err) {
      setError('Identifiants incorrects ou API inaccessible.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession();
    setIsConnected(false);
  };

  return (
    <AuthContext.Provider value={{ isConnected, login, logout, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
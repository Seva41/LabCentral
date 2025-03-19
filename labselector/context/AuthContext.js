import { createContext, useState, useContext } from "react";

const AuthContext = createContext();
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = async (newToken) => {
    setToken(newToken);

    try {
      const response = await fetch(`${API_URL}/api/user`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin);
      } else {
        console.error("Failed to fetch user info");
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const logout = async () => {
    if (!token) {
      // Si no hay token, simplemente limpia el estado
      setToken(null);
      setIsAdmin(false);
      return;
    }

    try {
      // Llamas primero a /api/logout para que el backend
      // remueva contenedores y haga la lógica necesaria
      await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const resp = await fetch(`${API_URL}/api/user_exercises`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const exercises = await resp.json();
        if (Array.isArray(exercises)) {
          for (const ex of exercises) {
            if (!ex.completed) {
              await fetch(`${API_URL}/api/exercise/${ex.id}/stop`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error en logout:", err);
    }

    // Finalmente, resetea el estado
    setToken(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ token, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

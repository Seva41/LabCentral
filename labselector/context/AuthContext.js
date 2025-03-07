import { createContext, useState, useContext } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = async (newToken) => {
    setToken(newToken);

    try {
      const response = await fetch("http://localhost:5001/api/user", {
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
      await fetch("http://localhost:5001/api/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Si quieres, luego puedes pedir ejercicios y detenerlos,
      // o podrías hacerlo *antes* de /api/logout, según tu flujo.
      // Por ejemplo, usando el mismo token:
      const resp = await fetch("http://localhost:5001/api/user_exercises", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const exercises = await resp.json();
        if (Array.isArray(exercises)) {
          for (const ex of exercises) {
            if (!ex.completed) {
              await fetch(`http://localhost:5001/api/exercise/${ex.id}/stop`, {
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

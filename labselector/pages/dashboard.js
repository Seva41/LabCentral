import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardHeader from "../components/DashboardHeader";
import AdminPanel from "../components/AdminPanel";
import ExercisesList from "../components/ExercisesList";
import CollapsibleCard from "../components/CollapsibleCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Dashboard() {
  const router = useRouter();
  const [exercises, setExercises] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [userLast, setUserLast] = useState("");

  // Cargar preferencia de dark mode
  useEffect(() => {
    const storedDarkMode = localStorage.getItem("darkMode");
    if (storedDarkMode === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Verificar login y obtener datos del usuario
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.error) {
          router.push("/login");
        } else {
          setIsAdmin(data.is_admin);
          setUserName(data.first_name || data.email);
          setUserLast(data.last_name || "");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  // Cargar lista de ejercicios
  const fetchExercises = async () => {
    try {
      const response = await fetch(`${API_URL}/api/exercises`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!data.error) {
        setExercises(data);
      }
    } catch (error) {
      console.error("Error fetching exercises:", error);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", newMode.toString());
  };

  // Logout
  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        router.push("/login");
      } else {
        alert("Failed to logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Eliminar ejercicio (solo admin)
  const deleteExercise = async (exerciseId) => {
    try {
      const response = await fetch(`${API_URL}/api/exercise/${exerciseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setExercises(exercises.filter((ex) => ex.id !== exerciseId));
      } else {
        alert("Failed to delete exercise");
      }
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  return (
    <div
      className={`layout min-h-screen ${
        darkMode
          ? "bg-gray-900 text-gray-100"
          : "bg-gradient-to-br from-[#1e3a8a] via-[#3b82f6] to-[#a5b4fc] text-white"
      }`}
    >
      <div className="content container mx-auto p-4">
        <DashboardHeader
          userName={userName}
          userLast={userLast}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          handleLogout={handleLogout}
        />

        {/* Panel de administración en tarjeta colapsable */}
        {isAdmin && (
          <CollapsibleCard title="Panel de Administración" defaultOpen={true}>
            <AdminPanel refreshExercises={fetchExercises} />
          </CollapsibleCard>
        )}

        <CollapsibleCard title="Lista de Ejercicios" defaultOpen={true}>
          <ExercisesList
            exercises={exercises}
            isAdmin={isAdmin}
            deleteExercise={deleteExercise}
          />
        </CollapsibleCard>
      </div>
    </div>
  );
}

export default Dashboard;

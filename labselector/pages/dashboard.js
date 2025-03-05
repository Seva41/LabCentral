import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FaSun, FaMoon } from "react-icons/fa";

function Dashboard() {
  const router = useRouter();

  // Estados
  const [exercises, setExercises] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);

  // Para agregar un nuevo ejercicio (solo si eres admin)
  const [newExercise, setNewExercise] = useState({
    title: "",
    description: "",
    docker_image: "",
    port: "",
  });

  // 1. Verificar si el usuario está logeado y si es admin
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // /api/user dará {email, is_admin} si la cookie es válida
        const res = await fetch("http://localhost:5000/api/user", {
          credentials: "include", // Imprescindible para enviar la cookie
        });
        const data = await res.json();
        if (data.error) {
          // no hay sesión, regresar a /login
          router.push("/login");
        } else {
          setIsAdmin(data.is_admin);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  // 2. Cargar la lista de ejercicios (si el usuario está logeado)
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/exercises", {
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
    fetchExercises();
  }, []);

  // Modo oscuro
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark", !darkMode);
  };

  // Agregar un ejercicio (solo admin)
  const addExercise = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/exercise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Usa cookies
        body: JSON.stringify({
          title: newExercise.title,
          description: newExercise.description,
          dockerfile_path: newExercise.docker_image, 
          port: newExercise.port,
        }),
      });

      if (response.ok) {
        alert("Exercise added successfully");
        // Como el endpoint retorna solo {message}, recarga la lista manualmente
        const updatedRes = await fetch("http://localhost:5000/api/exercises", {
          credentials: "include",
        });
        const updatedExercises = await updatedRes.json();
        setExercises(updatedExercises);

        // Limpia el form
        setNewExercise({
          title: "",
          description: "",
          docker_image: "",
          port: "",
        });
      } else {
        alert("Failed to add exercise");
      }
    } catch (error) {
      console.error("Error adding exercise:", error);
    }
  };

  // Borrar ejercicio (solo admin)
  const deleteExercise = async (exerciseId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/exercise/${exerciseId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setExercises(exercises.filter((exercise) => exercise.id !== exerciseId));
      } else {
        alert("Failed to delete exercise");
      }
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  // Iniciar ejercicio
  const startExercise = async (exerciseId) => {
    setLoading(true);
    setStatusMessage("Iniciando contenedor, por favor espera...");
    setShowSpinner(true);

    try {
      const response = await fetch(`http://localhost:5000/api/exercise/${exerciseId}/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        // Recibimos data.proxy_url, p.ej: "/api/exercise/1/proxy"
        if (data.proxy_url) {
          // Espera 4 segundos antes de abrir la nueva pestaña
          setTimeout(() => {
            window.open(`http://localhost:5000${data.proxy_url}`, "_blank");
            setStatusMessage(""); 
            setShowSpinner(false);
          }, 4000);
        } else {
          alert(data.message || `Exercise ${exerciseId} started`);
          setShowSpinner(false);
          setStatusMessage("");
        }
      } else {
        alert(data.error || "Failed to start exercise");
        setShowSpinner(false);
        setStatusMessage("");
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
      alert("Error connecting to the backend");
      setShowSpinner(false);
      setStatusMessage("");
    } finally {
      setLoading(false);
    }
  };

  // Cerrar ejercicio
  const stopExercise = async (exerciseId) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/exercise/${exerciseId}/stop`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || `Exercise ${exerciseId} stopped`);
      } else {
        alert(data.error || "Failed to stop exercise");
      }
    } catch (error) {
      console.error("Error stopping exercise:", error);
      alert("Error connecting to the backend");
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        router.push("/login");
      } else {
        alert("Failed to logout");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div className="container mx-auto p-4">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-center">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <FaSun
                className={`text-gray-600 dark:text-gray-300 ${
                  darkMode ? "opacity-50" : "opacity-100"
                }`}
              />
              <label className="relative inline-block w-10 h-6 mx-2">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
                <div className="w-10 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition"></div>
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-4 transition"></div>
              </label>
              <FaMoon
                className={`text-gray-600 dark:text-gray-300 ${
                  darkMode ? "opacity-100" : "opacity-50"
                }`}
              />
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
  
        {/* Mensaje/Spinner de estado */}
        {statusMessage && (
          <div className="mb-4 flex items-center space-x-3">
            {showSpinner && (
              <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{statusMessage}</span>
          </div>
        )}
  
        {/* Admin Panel */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-gray-200 dark:bg-gray-800 border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Admin Panel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Exercise Title"
                value={newExercise.title}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, title: e.target.value })
                }
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Description"
                value={newExercise.description}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, description: e.target.value })
                }
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Dockerfile Path"
                value={newExercise.docker_image}
                onChange={(e) =>
                  setNewExercise({
                    ...newExercise,
                    docker_image: e.target.value,
                  })
                }
                className="p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Port"
                value={newExercise.port}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, port: e.target.value })
                }
                className="p-2 border rounded"
              />
            </div>
            <button
              onClick={addExercise}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Exercise
            </button>
          </div>
        )}
  
        {/* Lista de ejercicios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
            >
              <h2 className="text-lg font-semibold">{exercise.title}</h2>
              <p className="text-sm mb-4">{exercise.description}</p>
              <button
                onClick={() => startExercise(exercise.id)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={loading}
              >
                {loading ? "Starting..." : "Start Exercise"}
              </button>
              <button
                onClick={() => stopExercise(exercise.id)}
                className="ml-2 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                disabled={loading}
              >
                {loading ? "Stopping..." : "Stop"}
              </button>
              {isAdmin && (
                <button
                  onClick={() => deleteExercise(exercise.id)}
                  className="ml-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

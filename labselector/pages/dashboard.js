import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FaSun, FaMoon } from "react-icons/fa";

function Dashboard() {
  const router = useRouter();
  const [exercises, setExercises] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  // Diccionario: { [exerciseId]: "starting" | "stopping" | null }
  const [loadingStates, setLoadingStates] = useState({});

  const [isAdmin, setIsAdmin] = useState(false);

  // Texto y spinner global (para avisos generales)
  const [statusMessage, setStatusMessage] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);

  // Datos del nuevo ejercicio (para admin)
  const [newExercise, setNewExercise] = useState({
    title: "",
    description: "",
    port: "",
  });
  // Archivo ZIP con el ejercicio completo
  const [exerciseZip, setExerciseZip] = useState(null);

  // Helper: retorna el estado ("starting", "stopping" o null) para el exerciseId
  const getLoadingLabel = (exerciseId) => {
    return loadingStates[exerciseId] || null;
  };

  // Helper para actualizar el estado loadingStates de un ejercicio
  const setExerciseLoading = (exerciseId, state) => {
    console.log(`Setting exercise ${exerciseId} to ${state}`);
    setLoadingStates((prev) => ({ ...prev, [exerciseId]: state }));
  };

  // Verificar si el usuario está logueado y es admin
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/user", {
          credentials: "include",
        });
        const data = await res.json();
        if (data.error) {
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

  // Cargar lista de ejercicios
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch("http://localhost:5001/api/exercises", {
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

  // Subir ZIP y crear nuevo ejercicio (solo admin)
  const addExerciseWithZip = async () => {
    if (!exerciseZip) {
      alert("Please select a ZIP file first.");
      return;
    }
    const formData = new FormData();
    formData.append("title", newExercise.title);
    formData.append("description", newExercise.description);
    formData.append("port", newExercise.port);
    formData.append("zipfile", exerciseZip);

    try {
      const response = await fetch("http://localhost:5001/api/exercise_with_zip", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        alert("Exercise added successfully");
        // Recargar la lista de ejercicios
        const updatedRes = await fetch("http://localhost:5001/api/exercises", {
          credentials: "include",
        });
        const updatedExercises = await updatedRes.json();
        setExercises(updatedExercises);

        // Limpiar el form
        setNewExercise({ title: "", description: "", port: "" });
        setExerciseZip(null);
      } else {
        alert("Failed to add exercise");
      }
    } catch (error) {
      console.error("Error adding exercise with zip:", error);
    }
  };

  // Eliminar ejercicio (solo admin)
  const deleteExercise = async (exerciseId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/exercise/${exerciseId}`, {
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

  // Iniciar ejercicio
  const startExercise = async (exerciseId) => {
    setExerciseLoading(exerciseId, "starting");
    setStatusMessage("Iniciando contenedor...");
    setShowSpinner(true);

    try {
      const response = await fetch(`http://localhost:5001/api/exercise/${exerciseId}/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        if (data.proxy_url) {
          // Espera 4 segundos antes de abrir para dar tiempo a que arranque el contenedor
          setTimeout(() => {
            window.open(`http://localhost:5001${data.proxy_url}`, "_blank");
            setStatusMessage("");
            setShowSpinner(false);
          }, 4000);
        } else {
          alert(data.message || `Exercise ${exerciseId} started`);
          setStatusMessage("");
          setShowSpinner(false);
        }
      } else {
        alert(data.error || "Failed to start exercise");
        setStatusMessage("");
        setShowSpinner(false);
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
      alert("Error connecting to the backend");
      setStatusMessage("");
      setShowSpinner(false);
    } finally {
      setExerciseLoading(exerciseId, null);
    }
  };

  // Detener ejercicio
  const stopExercise = async (exerciseId) => {
    setExerciseLoading(exerciseId, "stopping");

    try {
      const response = await fetch(`http://localhost:5001/api/exercise/${exerciseId}/stop`, {
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
      setExerciseLoading(exerciseId, null);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:5001/api/logout", {
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

  return (
    <div className={`${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"} min-h-screen`}>
      <div className="container mx-auto p-4">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-center">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <FaSun className={`text-gray-600 dark:text-gray-300 ${darkMode ? "opacity-50" : "opacity-100"}`} />
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
              <FaMoon className={`text-gray-600 dark:text-gray-300 ${darkMode ? "opacity-100" : "opacity-50"}`} />
            </div>
            {/* Botón Logout */}
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mensaje global */}
        {statusMessage && (
          <div className="mb-4 flex items-center space-x-3">
            {showSpinner && (
              <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Panel de Admin (subida de ZIP) */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-gray-200 dark:bg-gray-800 border rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Admin Panel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Exercise Title"
                value={newExercise.title}
                onChange={(e) => setNewExercise({ ...newExercise, title: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Description"
                value={newExercise.description}
                onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Port"
                value={newExercise.port}
                onChange={(e) => setNewExercise({ ...newExercise, port: e.target.value })}
                className="p-2 border rounded"
              />
              {/* Subir ZIP */}
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    setExerciseZip(e.target.files[0]);
                  } else {
                    setExerciseZip(null);
                  }
                }}
                className="p-2 border rounded"
              />
            </div>
            <button
              onClick={addExerciseWithZip}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Exercise (ZIP)
            </button>
          </div>
        )}

        {/* Lista de ejercicios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((exercise) => {
            const state = getLoadingLabel(exercise.id);
            const isLoading = Boolean(state);
            return (
              <div
                key={exercise.id}
                className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
              >
                <h2 className="text-lg font-semibold">{exercise.title}</h2>
                <p className="text-sm mb-4">{exercise.description}</p>

                {/* Botón Start */}
                <button
                  onClick={() => startExercise(exercise.id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  disabled={isLoading}
                >
                  {state === "starting" ? "Starting..." : "Start"}
                </button>

                {/* Botón Stop */}
                <button
                  onClick={() => stopExercise(exercise.id)}
                  className="ml-2 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                  disabled={isLoading}
                >
                  {state === "stopping" ? "Stopping..." : "Stop"}
                </button>

                {/* Botón Delete (solo admin) */}
                {isAdmin && (
                  <button
                    onClick={() => deleteExercise(exercise.id)}
                    className="ml-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
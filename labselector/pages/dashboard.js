import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaSun, FaMoon } from "react-icons/fa";

// Definimos la URL base del backend a partir de la variable de entorno
const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Dashboard() {
  const router = useRouter();
  const [exercises, setExercises] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Datos para añadir un ejercicio nuevo (solo admin)
  const [newExercise, setNewExercise] = useState({
    title: "",
    description: "",
  });
  // Archivo ZIP
  const [exerciseZip, setExerciseZip] = useState(null);

  // Al montar, cargar preferencia de dark mode desde localStorage
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

  // Verificar login y admin
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
    fetchExercises();
  }, []);

  // Función para alternar modo oscuro y guardar la preferencia
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

  // Subir ZIP y crear nuevo ejercicio (solo admin)
  const addExerciseWithZip = async () => {
    if (!exerciseZip) {
      alert("Please select a ZIP file first.");
      return;
    }
    const formData = new FormData();
    formData.append("title", newExercise.title);
    formData.append("description", newExercise.description);
    formData.append("zipfile", exerciseZip);

    try {
      const response = await fetch(`${API_URL}/api/exercise_with_zip`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        alert("Exercise added successfully");
        // Recargar ejercicios
        const updatedRes = await fetch(`${API_URL}/api/exercises`, {
          credentials: "include",
        });
        const updatedExercises = await updatedRes.json();
        setExercises(updatedExercises);

        // Reset form
        setNewExercise({ title: "", description: "" });
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
      const response = await fetch(
        `${API_URL}/api/exercise/${exerciseId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (response.ok) {
        setExercises(exercises.filter((ex) => ex.id !== exerciseId));
      } else {
        alert("Failed to delete exercise");
      }
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
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

  return (
    <div
      className={`${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      } min-h-screen`}
    >
      <div className="container mx-auto p-4">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Toggle de tema oscuro */}
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
            {/* Botón Logout */}
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Panel de Admin */}
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
                  setNewExercise({
                    ...newExercise,
                    description: e.target.value,
                  })
                }
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
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
            >
              <h2 className="text-lg font-semibold mb-2">{exercise.title}</h2>
              <p className="text-sm mb-4">{exercise.description}</p>

              {/* Botón que lleva al detalle del ejercicio */}
              <Link href={`/exercises/${exercise.id}`}>
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Ver detalle
                </button>
              </Link>

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
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

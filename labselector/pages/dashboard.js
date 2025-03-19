import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaSun, FaMoon, FaTimes } from "react-icons/fa"; // Se agregó FaTimes

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Dashboard() {
  const router = useRouter();
  const [exercises, setExercises] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [userLast, setUserLast] = useState("");

  // Datos para añadir un ejercicio nuevo (solo admin)
  const [newExercise, setNewExercise] = useState({
    title: "",
    description: "",
  });
  const [exerciseZip, setExerciseZip] = useState(null);

  // Campos para generar token de reset de contraseña (solo admin)
  const [resetEmail, setResetEmail] = useState("");
  const [resetTokenGenerated, setResetTokenGenerated] = useState("");

  // Campos para la creación masiva de usuarios (solo admin)
  const [bulkUsers, setBulkUsers] = useState([]);
  const [newBulkUser, setNewBulkUser] = useState({
    email: "",
    first_name: "",
    last_name: "",
  });
  const [bulkUsersMessage, setBulkUsersMessage] = useState("");

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

  // Verificar login, obtener datos del usuario y admin
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
        const updatedRes = await fetch(`${API_URL}/api/exercises`, {
          credentials: "include",
        });
        const updatedExercises = await updatedRes.json();
        setExercises(updatedExercises);
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

  // Generar token de reseteo de contraseña (solo admin)
  const handleResetToken = async () => {
    try {
      const response = await fetch(`${API_URL}/api/request_password_reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json();
      if (data.reset_token) {
        setResetTokenGenerated(data.reset_token);
      } else {
        setResetTokenGenerated("");
        alert("No se pudo generar un token (el usuario no existe o error desconocido).");
      }
    } catch (error) {
      console.error("Error generando token de reseteo:", error);
      alert("Error generando token");
    }
  };

  // Función para agregar un usuario a la lista de creación masiva (solo admin)
  const handleAddBulkUser = () => {
    if (!newBulkUser.email || !newBulkUser.first_name || !newBulkUser.last_name) {
      alert("Todos los campos son requeridos para el usuario.");
      return;
    }
    setBulkUsers([...bulkUsers, newBulkUser]);
    setNewBulkUser({ email: "", first_name: "", last_name: "" });
  };

  // Función para eliminar un usuario de la cola de creación masiva
  const handleRemoveBulkUser = (indexToRemove) => {
    setBulkUsers(bulkUsers.filter((_, index) => index !== indexToRemove));
  };

  // Generar usuarios en masa (solo admin)
  const handleBulkCreateUsers = async () => {
    if (bulkUsers.length === 0) {
      setBulkUsersMessage("No hay usuarios para crear.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/admin/bulk_create_users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("admin_token"),
        },
        credentials: "include",
        body: JSON.stringify({ users: bulkUsers }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.created && data.created.length > 0) {
          let msg = "Usuarios creados exitosamente:\n";
          data.created.forEach((u) => {
            msg += `${u.email}: ${u.temp_password}\n`;
          });
          setBulkUsersMessage(msg);
        } else {
          setBulkUsersMessage("No se crearon usuarios nuevos.");
        }
        setBulkUsers([]);
      } else {
        setBulkUsersMessage(data.error || "Error al crear usuarios.");
      }
    } catch (error) {
      console.error("Error en creación masiva:", error);
      setBulkUsersMessage("Error en la petición.");
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
        {/* Mensaje de bienvenida centrado */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">
            Hola, {userName} {userLast}!
          </h1>
        </div>

        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
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
              className="px-4 py-2 rounded text-white bg-red-700 hover:bg-red-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Panel de Admin */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Sección para agregar ejercicio con ZIP */}
            <div className="card mb-6 p-4">
              <h2 className="text-lg font-semibold mb-4">
                Agregar Ejercicio (Admin)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Exercise Title"
                  value={newExercise.title}
                  onChange={(e) =>
                    setNewExercise({ ...newExercise, title: e.target.value })
                  }
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newExercise.description}
                  onChange={(e) =>
                    setNewExercise({ ...newExercise, description: e.target.value })
                  }
                  className="input"
                />
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
                  className="input"
                />
              </div>
              <button
                onClick={addExerciseWithZip}
                className="button button-gradient"
              >
                Add Exercise (ZIP)
              </button>
            </div>

            {/* Sección para generar token de reseteo de contraseña */}
            <div className="card p-4">
              <h2 className="text-lg font-semibold mb-4">
                Reset de Contraseña (Admin)
              </h2>
              <p className="text-sm mb-3">
                Ingresa el correo del usuario. Si existe, se generará un token de
                reseteo para que ese usuario pueda cambiar su contraseña en{" "}
                <strong>/reset-password</strong>.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-4">
                <input
                  type="email"
                  placeholder="Correo del usuario"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input"
                />
                <button
                  onClick={handleResetToken}
                  className="button button-gradient"
                >
                  Generar Token
                </button>
              </div>
              {resetTokenGenerated && (
                <div className="mt-4 break-words">
                  <strong>Token generado:</strong> {resetTokenGenerated}
                  <br />
                  <span className="text-xs">
                    Entrégaselo al usuario para que lo use en <b>/reset-password</b>
                  </span>
                </div>
              )}
            </div>

            {/* Sección de creación masiva de usuarios */}
            <div className="card p-4">
              <h2 className="text-lg font-semibold mb-4">
                Creación Masiva de Usuarios (Admin)
              </h2>
              <p className="text-sm mb-3">
                Ingresa los datos del usuario y presiona "Agregar Usuario a la
                cola". Luego, presiona "Crear Usuarios en Cola" para procesar la
                lista.<br/>
                Si la creación es exitosa, se generará una contraseña temporal para
                cada usuario. Esta contraseña se mostrará en la lista de usuarios
                creados.<br/>
                <b>ESTA ES LA ÚNICA VEZ QUE SE MUESTRA LA CONTRASEÑA TEMPORAL.</b> Asegúrate
                de copiarla a un lugar seguro.
              </p>
              {/* Formulario para agregar un usuario individual */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={newBulkUser.first_name}
                  onChange={(e) =>
                    setNewBulkUser({
                      ...newBulkUser,
                      first_name: e.target.value,
                    })
                  }
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Apellido"
                  value={newBulkUser.last_name}
                  onChange={(e) =>
                    setNewBulkUser({
                      ...newBulkUser,
                      last_name: e.target.value,
                    })
                  }
                  className="input"
                />
                <input
                  type="email"
                  placeholder="Correo"
                  value={newBulkUser.email}
                  onChange={(e) =>
                    setNewBulkUser({ ...newBulkUser, email: e.target.value })
                  }
                  className="input"
                />
              </div>
              <button
                onClick={handleAddBulkUser}
                className="button bg-green-600 hover:bg-green-800 mb-4"
              >
                Agregar Usuario a la cola
              </button>
              {bulkUsers.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold">Usuarios a crear:</h3>
                  <ul className="list-disc ml-4">
                    {bulkUsers.map((user, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {user.first_name} {user.last_name} - {user.email}
                        </span>
                        <button onClick={() => handleRemoveBulkUser(index)}>
                          <FaTimes className="text-red-500 hover:text-red-700" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={handleBulkCreateUsers}
                className="button button-gradient"
              >
                Crear Usuarios en Cola
              </button>
              {bulkUsersMessage && (
                <pre className="mt-2 text-sm whitespace-pre-wrap">
                  {bulkUsersMessage}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Lista de ejercicios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="card shadow-md hover:shadow-xl transition-shadow mb-4"
            >
              <h2 className="text-lg font-semibold mb-2">{exercise.title}</h2>
              <p className="text-sm mb-4">{exercise.description}</p>

              <Link href={`/exercises/${exercise.id}`}>
                <button
                  className="px-4 py-2 rounded text-white bg-purple-700 hover:bg-purple-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600"
                >
                  Ver detalle
                </button>
              </Link>

              {isAdmin && (
                <button
                  onClick={() => deleteExercise(exercise.id)}
                  className="ml-2 px-4 py-2 rounded text-white bg-red-700 hover:bg-red-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600"
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

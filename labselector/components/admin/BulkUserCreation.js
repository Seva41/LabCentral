import { useState } from "react";
import { FaTimes } from "react-icons/fa";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function BulkUserCreation() {
  const [bulkUsers, setBulkUsers] = useState([]);
  const [newBulkUser, setNewBulkUser] = useState({
    email: "",
    first_name: "",
    last_name: "",
  });
  const [bulkUsersMessage, setBulkUsersMessage] = useState("");

  const handleAddBulkUser = () => {
    if (!newBulkUser.email || !newBulkUser.first_name || !newBulkUser.last_name) {
      alert("Todos los campos son requeridos para el usuario.");
      return;
    }
    setBulkUsers([...bulkUsers, newBulkUser]);
    setNewBulkUser({ email: "", first_name: "", last_name: "" });
  };

  const handleRemoveBulkUser = (indexToRemove) => {
    setBulkUsers(bulkUsers.filter((_, index) => index !== indexToRemove));
  };

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
    <div className="card p-4">
      <h2 className="text-lg font-semibold mb-4">Creación Masiva de Usuarios (Admin)</h2>
      <p className="text-sm mb-3">
        Ingresa los datos del usuario y presiona &quot;Agregar Usuario a la cola&quot;. Luego, presiona &quot;Crear Usuarios en Cola&quot; para procesar la lista.<br />
        Si la creación es exitosa, se generará una contraseña temporal para cada usuario. Esta contraseña se mostrará en la lista de usuarios creados.<br />
        <b>ESTA ES LA ÚNICA VEZ QUE SE MUESTRA LA CONTRASEÑA TEMPORAL.</b> Asegúrate de copiarla a un lugar seguro.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <input
          type="text"
          placeholder="Nombre"
          value={newBulkUser.first_name}
          onChange={(e) =>
            setNewBulkUser({ ...newBulkUser, first_name: e.target.value })
          }
          className="input"
        />
        <input
          type="text"
          placeholder="Apellido"
          value={newBulkUser.last_name}
          onChange={(e) =>
            setNewBulkUser({ ...newBulkUser, last_name: e.target.value })
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
              <li key={index} className="flex items-center justify-between">
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
  );
}

export default BulkUserCreation;

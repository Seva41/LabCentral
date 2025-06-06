import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function GroupExercisePage() {
  const router = useRouter();
  const { id } = router.query;

  const [users, setUsers] = useState([]);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [existingGroup, setExistingGroup] = useState(null);

  useEffect(() => {
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      console.error("Invalid exercise ID:", id);
      return;
    }
  
    const fetchGroup = async () => {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        console.error("Invalid exercise ID:", id);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/exercise/${id}/my_group`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.group_id) {
          setExistingGroup(data);
        } else {
          setExistingGroup(null);
        }
      } catch (error) {
        console.error("Error fetching group info:", error);
      }
    };
  
    const fetchAvailableUsers = async () => {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        setMessage("Invalid exercise ID.");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/exercise/${id}/available_users`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.error("Error fetching available users:", res.status);
          return;
        }
        const data = await res.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
  
    fetchGroup();
    fetchAvailableUsers();
  }, [id]);
  
  const handleSubmit = async (e) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setMessage("Invalid exercise ID.");
      return;
    }
    e.preventDefault();
    if (existingGroup) {
      setMessage("Ya formas parte de un grupo para este ejercicio.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/exercise/${id}/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ partner_email: partnerEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setExistingGroup(data);
      } else {
        setMessage(data.error || "Error al crear el grupo.");
      }
    } catch (error) {
      setMessage(`Error al conectar con el servidor: ${error.message}`);
    }
  };

  const handleDisbandGroup = async () => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setMessage("Invalid exercise ID.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/exercise/${id}/group`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setExistingGroup(null);
        setMessage(data.message);
      } else {
        setMessage(data.error || "Error al disolver el grupo.");
      }
    } catch (error) {
      setMessage(`Error al conectar con el servidor: ${error.message}`);
    }
  };

  return (
    <div className="layout min-h-screen">
      <div className="content w-full max-w-md mx-auto px-4 py-8">
        <div className="card p-6">
          <h1 className="text-2xl font-bold mb-4">
            Formar Grupo para el Ejercicio {id}
          </h1>

          {existingGroup ? (
            <div className="p-4 bg-green-100 text-green-900 rounded shadow">
              <h2 className="text-xl font-bold">Ya formas parte de un grupo</h2>
              <p><strong>Líder:</strong> {existingGroup.leader.email}</p>
              <p><strong>Compañero:</strong> {existingGroup.partner.email}</p>

              <button
                onClick={handleDisbandGroup}
                className="button button-gradient mt-4"
              >
                Disolver Grupo
              </button>

              {message && <p className="mt-4">{message}</p>}

              <div className="mt-4">
                <Link href={`/exercises/${id}`}>
                  <span className="button bg-gray-500 hover:bg-gray-600 cursor-pointer">
                    Volver al Ejercicio
                  </span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1">Selecciona un compañero:</label>
                  <select
                    className="select"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    required
                  >
                    <option value="">-- Elige un compañero --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.email}>
                        {user.email} ({user.first_name} {user.last_name})
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="button button-gradient">
                  Crear Grupo
                </button>
              </form>

              {message && <p className="mt-4">{message}</p>}

              <div className="mt-4">
                <Link href={`/exercises/${id}`}>
                  <span className="button bg-gray-500 hover:bg-gray-600 cursor-pointer">
                    Volver
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

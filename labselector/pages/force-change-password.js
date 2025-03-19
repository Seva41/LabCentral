import { useState } from "react";
import { useRouter } from "next/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ForceChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const router = useRouter();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("temp_force_token");
      if (!token) {
        alert("No hay token temporal. Reintenta login.");
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_URL}/api/force_change_password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
        alert("Contraseña cambiada exitosamente");
        // Limpia la storage y redirige
        localStorage.removeItem("temp_force_token");
        router.push("/login");
      } else {
        alert(data.error || "Error al cambiar contraseña");
      }
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      alert("Error de conexión");
    }
  };

  return (
    <div className="layout flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8">Cambiar Contraseña</h1>

        <form onSubmit={handleChangePassword} className="card p-6 space-y-4">
          <p>
            Ingresa tu nueva contraseña para completar el proceso de cambio obligatorio.
          </p>
          <input
            type="password"
            placeholder="Nueva Contraseña"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <button type="submit" className="button w-full bg-blue-600 hover:bg-blue-800">
            Cambiar Contraseña
          </button>
        </form>
      </div>
    </div>
  );
}

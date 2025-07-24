import { useState } from "react";
import axios from "axios";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ResetPassword() {
  // El token que el admin le entregó al usuario
  const [resetToken, setResetToken] = useState("");
  // La nueva contraseña
  const [newPassword, setNewPassword] = useState("");
  // Confirmación de la nueva contraseña
  const [confirmPassword, setConfirmPassword] = useState("");
  // Mensajes informativos o de error
  const [message, setMessage] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    try {
      // Llamamos al endpoint /api/reset_password enviando token y new_password
      const response = await axios.post(`${API_URL}/api/reset_password`, {
        token: resetToken,
        new_password: newPassword,
      });
      const data = response.data;

      if (data.error) {
        setMessage(data.error);
      } else {
        setMessage("¡Contraseña actualizada correctamente! Ya puedes iniciar sesión.");
      }
    } catch (error) {
      setMessage(`Ocurrió un error. Inténtalo nuevamente.`);
      console.log("Error al cambiar la contraseña:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center">
        <form onSubmit={handleReset} className="card shadow-lg space-y-6 w-full max-w-md p-6">
          <h1 className="text-2xl font-bold text-center">Cambiar Contraseña</h1>
          <p className="text-sm text-center">
            Pide al administrador que te genere un token de cambio de contraseña. Luego, ingresa aquí el token que te proporcionó y tu nueva contraseña.
          </p>

          {/* Token de reseteo */}
          <div>
            <input
              type="text"
              placeholder="Token de Reseteo"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              className="input"
            />
          </div>

          {/* Nueva contraseña */}
          <div>
            <input
              type="password"
              placeholder="Nueva Contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          {/* Confirmación de contraseña */}
          <div>
            <input
              type="password"
              placeholder="Confirmar Nueva Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          <button type="submit" className="button bg-blue-700 hover:bg-blue-900 w-full">
            Cambiar Contraseña
          </button>

          {message && <p className="text-sm text-center">{message}</p>}

          <div className="text-center">
            <Link href="/login">
              <button
                type="button"
                className="button bg-gradient-to-r from-[#3b82f6] to-[#9333ea] w-full mt-4"
              >
                Volver al Login
              </button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

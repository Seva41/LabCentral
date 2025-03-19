import { useState } from "react";
import axios from "axios";
import Link from "next/link";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/request_password_reset`, { email });
      setMessage("Si el correo está registrado, se ha enviado un enlace de recuperación.");
    } catch {
      setMessage("Ocurrió un error. Inténtalo nuevamente.");
    }
  };

  return (
    // Contenedor flex con min-h-screen
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center">
        <form onSubmit={handleReset} className="card shadow-lg space-y-6 w-full max-w-md p-6">
          <h1 className="text-2xl font-bold text-center">Recuperar Contraseña</h1>

          <div>
            <input
              type="email"
              placeholder="Correo Electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </div>

          <button type="submit" className="button bg-blue-700 hover:bg-blue-900 w-full">
            Enviar Enlace
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

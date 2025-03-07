import { useState } from "react";
import axios from "axios";
import Link from "next/link";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5001/api/request_password_reset", { email });
      setMessage("Si el correo está registrado, se ha enviado un enlace de recuperación.");
    } catch {
      setMessage("Ocurrió un error. Inténtalo nuevamente.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleReset}
        className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg rounded-xl"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">Recuperar Contraseña</h1>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-400"
        >
          Enviar Enlace
        </button>

        {message && (
          <p className="mt-4 text-sm text-center text-gray-600">
            {message}
          </p>
        )}

        {/* Botón para volver al login */}
        <div className="text-center">
          <Link href="/login">
            <button
              type="button"
              className="mt-4 px-4 py-2 text-blue-500 border border-blue-500 rounded-lg hover:bg-blue-500 hover:text-white focus:ring-2 focus:ring-blue-400"
            >
              Volver al Login
            </button>
          </Link>
        </div>
      </form>
    </div>
  );
}

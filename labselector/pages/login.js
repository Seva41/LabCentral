import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        console.log("Login exitoso, redirigiendo a /dashboard...");
        router.push("/dashboard");
      } else {
        alert(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Failed to connect to the backend:", error);
      alert("Failed to connect to the backend");
    }
  };

  return (
    // Usa la clase .layout (y/o .content si lo deseas) para mantener consistencia.
    <div className="layout flex items-center justify-center min-h-screen">
      
      {/* Usa la clase .card para el efecto “glassmorphism” y un contenedor elegante */}
      <form onSubmit={handleLogin} className="card w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">Iniciar Sesión</h1>

        <div className="space-y-4">
          {/* Usa la clase .input para un estilo consistente con tu globals.css */}
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>

        {/* Aplica la clase .button para el estilo de botón gradiente */}
        <button
          type="submit"
          className="button w-full"
        >
          Iniciar Sesión
        </button>

        {/* Sección de enlaces y recordatorios */}
        <div className="text-sm text-center">
          <p>
            <Link href="/reset-password" className="underline hover:text-gray-200">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <p className="mt-2">
            ¿No tienes una cuenta?{" "}
            <Link href="/signup" className="underline hover:text-gray-200">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default Login;

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
      const response = await fetch(`${API_URL}/api/login`, {
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
    <div className="layout flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md px-4">
        <h1 className="text-6xl font-bold text-center mb-14">LabCentral</h1>

        {/* Form con estilo .card para un efecto glassmorphism */}
        <form onSubmit={handleLogin} className="card w-full p-8 space-y-6">
          <h2 className="text-2xl font-bold text-center">Inicio de Sesión</h2>

          <div className="space-y-4">
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

          {/* Botón con gradiente */}
          <button type="submit" className="button w-full bg-gradient-to-r from-[#3b82f6] to-[#9333ea]">
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
    </div>
  );
}

export default Login;

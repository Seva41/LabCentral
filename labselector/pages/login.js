import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
        credentials: "include", // para que envíe/reciba la cookie
      });
      const data = await response.json();

      if (response.ok) {
        if (data.force_password_change) {
          // Usuario con cambio forzado: guardamos token temporal y redirigimos
          localStorage.setItem("temp_force_token", data.token);
          alert("Debes cambiar tu contraseña ahora");
          router.push("/force-change-password");
        } else {
          // Login normal: si es admin, guardamos el token en admin_token
          if (data.is_admin) {
            localStorage.setItem("admin_token", data.token);
          }
          router.push("/dashboard");
        }
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
          <button
            type="submit"
            className="button w-full bg-gradient-to-r from-[#3b82f6] to-[#9333ea]"
          >
            Iniciar Sesión
          </button>
          <div className="text-sm text-center">
            <Link href="/reset-password" className="underline hover:text-gray-200">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;

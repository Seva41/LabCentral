import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

// Se define la URL base a partir de la variable de entorno
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg rounded-xl"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">Iniciar Sesión</h1>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-400"
        >
          Iniciar Sesión
        </button>

        <div className="text-sm text-center text-gray-600">
          <p>
            <Link href="/reset-password" className="text-blue-500 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <p className="mt-2">
            ¿No tienes una cuenta?{" "}
            <Link href="/signup" className="text-blue-500 hover:underline">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default Login;

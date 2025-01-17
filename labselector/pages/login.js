import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('http://localhost:5000/api/login', { email, password });
      localStorage.setItem('token', data.token);
      router.push('/dashboard');
    } catch (err) {
      alert('Credenciales inválidas');
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

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => router.push('/reset-password')}
            className="text-sm text-blue-500 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <a href="/signup" className="text-blue-500 hover:underline">
              Regístrate aquí
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}

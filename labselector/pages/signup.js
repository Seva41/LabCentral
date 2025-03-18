import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5001/api/signup', {
        email,
        password,
        confirmPassword,
      });
      alert('Usuario creado exitosamente');
      router.push('/login');
    } catch (err) {
      alert(err.response?.data?.error || 'Error en el registro');
    }
  };

  return (
    <div className="layout min-h-screen">
      <div className="content flex items-center justify-center w-full px-4 py-8">
        {/* Form con clase .card para estilo “glassmorphism” */}
        <form onSubmit={handleSignup} className="card w-full max-w-md p-6 space-y-6 shadow-lg">
          <h1 className="text-2xl font-bold text-center">Regístrate</h1>

          <div className="space-y-4">
            {/* Inputs con clase .input para estilo traslúcido */}
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
            <input
              type="password"
              placeholder="Confirmar Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          {/* Botón con la clase .button */}
          <button
            type="submit"
            className="button button-gradient w-full"
          >
            Crear Cuenta
          </button>

          {/* Enlace a Login */}
          <p className="text-sm text-center">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="underline hover:text-gray-200">
              Inicia Sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/signup', {
        email,
        password,
        confirmPassword,
      });
      alert('Usuario creado exitosamente');
      router.push('/login');
    } catch (err) {
      console.error(err);
      alert('Error en el registro: ' + err.response?.data?.error || 'Desconocido');
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <h1>Crear Cuenta</h1>
      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Confirmar Contraseña"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <button type="submit">Registrarse</button>
    </form>
  );
}

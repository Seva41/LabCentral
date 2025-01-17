import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login'); // Redirige al login por defecto
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold text-blue-500 mb-4">Bienvenido a LabCentral</h1>
      <p className="text-gray-700">Contenido Principal de Prueba</p>
    </div>
  );
};
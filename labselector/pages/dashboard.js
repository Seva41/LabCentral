import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Dashboard() {
  const [exercises, setExercises] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login'); // Redirige si no hay token
        return;
      }

      try {
        const response = await axios.get('http://localhost:5000/api/user_exercises', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setExercises(response.data); // Asume que el backend devuelve una lista con los ejercicios y su estado
      } catch (err) {
        console.error(err);
        router.push('/login'); // Redirige en caso de error
      }
    };

    fetchData();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard de Ejercicios</h1>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              router.push('/login');
            }}
            className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 focus:ring-2 focus:ring-red-400"
          >
            Cerrar Sesión
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`p-6 rounded-lg shadow-md bg-white ${
                exercise.completed ? 'border-green-500 border-2' : 'border-gray-200'
              }`}
              onClick={() => router.push(`/exercise/${exercise.id}`)}
            >
              <h2 className="text-xl font-semibold">{exercise.title}</h2>
              <p className="text-gray-600">
                Estado: {exercise.completed ? 'Completado' : 'Pendiente'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Dashboard() {
  const [exercises, setExercises] = useState([]);
  const [completed, setCompleted] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchExercises = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login'); // Redirige si no hay token
        return;
      }

      try {
        const [allExercises, userExercises] = await Promise.all([
          axios.get('http://localhost:5000/api/exercises', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:5000/api/user_exercises', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setExercises(allExercises.data);
        setCompleted(userExercises.data.completed_exercises);
      } catch (err) {
        console.error(err);
        router.push('/login'); // Redirige en caso de error
      }
    };

    fetchExercises();
  }, [router]);

  const markCompleted = async (exerciseId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(
        'http://localhost:5000/api/complete_exercise',
        { exercise_id: exerciseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompleted((prev) => [...prev, exerciseId]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // Elimina el token
    router.push('/login'); // Redirige al login
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard de Ejercicios</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 focus:ring-2 focus:ring-red-400"
          >
            Cerrar Sesión
          </button>
        </div>

        <ul className="space-y-4">
          {exercises.map((exercise) => (
            <li
              key={exercise.id}
              className={`p-4 rounded-lg shadow-md ${
                completed.includes(exercise.id) ? 'bg-green-100' : 'bg-white'
              }`}
            >
              <h2 className="text-xl font-semibold">{exercise.title}</h2>
              <p className="text-gray-600">Estado: {completed.includes(exercise.id) ? 'Completado' : 'Pendiente'}</p>
              {!completed.includes(exercise.id) && (
                <button
                  onClick={() => markCompleted(exercise.id)}
                  className="px-4 py-2 mt-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Marcar como Completado
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

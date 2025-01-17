import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query; // Obtiene el ID del ejercicio desde la URL
  const [exercise, setExercise] = useState(null);

  useEffect(() => {
    const fetchExercise = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login'); // Redirige si no hay token
        return;
      }

      try {
        const response = await axios.get(`http://localhost:5000/api/exercise/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setExercise(response.data); // Asume que el backend devuelve el detalle del ejercicio
      } catch (err) {
        console.error(err);
        router.push('/dashboard'); // Redirige si hay un error
      }
    };

    if (id) fetchExercise();
  }, [id, router]);

  if (!exercise) return <p>Cargando...</p>;

  const startExercise = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/exercise/${id}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('¡Ejercicio iniciado!');
    } catch (err) {
      console.error(err);
      alert('No se pudo iniciar el ejercicio.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-3xl p-6 bg-white shadow-lg rounded-lg">
        <h1 className="text-2xl font-bold mb-4">{exercise.title}</h1>
        <p className="text-gray-700 mb-6">{exercise.description}</p>
        <button
          onClick={startExercise}
          className="px-6 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-400"
        >
          Empezar Ejercicio
        </button>
      </div>
    </div>
  );
}

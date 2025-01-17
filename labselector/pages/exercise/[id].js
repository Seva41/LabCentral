import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function ExerciseDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [exercise, setExercise] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchExercise = async () => {
        try {
          const response = await axios.get('http://localhost:5000/api/exercises');
          const selectedExercise = response.data.find((e) => e.id === parseInt(id));
          setExercise(selectedExercise);
        } catch (err) {
          console.error(err);
        }
      };
      fetchExercise();
    }
  }, [id]);

  if (!exercise) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{exercise.title}</h1>
      <p>{exercise.description || 'No hay descripción disponible.'}</p>
    </div>
  );
}

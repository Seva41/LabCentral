// src/Exercises.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface Exercise {
  id: number;
  title: string;
}

function Exercises() {
  const { token } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);

  useEffect(() => {
    // Fetch all available exercises
    axios.get('/api/exercises').then(res => {
      setExercises(res.data);
    });

    // Fetch user’s completed exercises
    if (token) {
      axios
        .get('/api/user_exercises', {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => {
          setCompleted(res.data.completed_exercises);
        })
        .catch(err => console.error(err));
    }
  }, [token]);

  const handleComplete = async (exerciseId: number) => {
    if (!token) return;
    await axios.post(
      '/api/complete_exercise',
      { exercise_id: exerciseId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setCompleted(prev => [...prev, exerciseId]);
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Exercises</h2>
      <div className="row">
        {exercises.map(ex => (
          <div className="col-md-6 mb-3" key={ex.id}>
            <div className="card shadow-sm">
              <div className="card-body d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{ex.title}</h5>
                {completed.includes(ex.id) ? (
                  <span className="badge bg-success">Completed</span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleComplete(ex.id)}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Exercises;

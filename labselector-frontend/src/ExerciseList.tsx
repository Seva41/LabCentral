// src/ExerciseList.tsx
import React from 'react';
import { Link } from 'react-router-dom';

// Example data structure
interface Exercise {
  id: number;
  title: string;
  completed: boolean;
}

// Mock data
const exercises: Exercise[] = [
  { id: 1, title: 'Basic Networking', completed: true },
  { id: 2, title: 'SQL Injection', completed: false },
  { id: 3, title: 'XSS Attack', completed: true },
  { id: 4, title: 'Buffer Overflow', completed: false },
  { id: 5, title: 'Privilege Escalation', completed: false },
  { id: 6, title: 'Password Cracking', completed: true },
];

function ExerciseList() {
  return (
    <div className="container py-4 fade-in">
      <h1 className="mb-4 text-center">Available Exercises</h1>

      <div className="row">
        {exercises.map((ex) => (
          <div className="col-md-6 mb-3" key={ex.id}>
            {/* Link entire card to the detail page */}
            <Link
              to={`/exercise/${ex.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card shadow-sm">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">{ex.title}</h5>
                  {ex.completed ? (
                    <span className="badge bg-success">Completed</span>
                  ) : (
                    <span className="badge bg-warning text-dark">Not Completed</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExerciseList;
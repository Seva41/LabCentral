// src/ExerciseDetail.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

function ExerciseDetail() {
  const { id } = useParams(); // get the exercise ID from URL

  // Placeholder content: in a real scenario, fetch exercise detail via ID
  return (
    <div className="container py-4 fade-in">
      <h2>Exercise Detail: ID {id}</h2>
      <p>
        Here is where i show the full exercise description, instructions,
        or any other relevant data fetched from the Flask API using the ID.
      </p>
    </div>
  );
}

export default ExerciseDetail;
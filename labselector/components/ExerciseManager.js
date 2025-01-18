import { useState } from "react";

function ExerciseManager({ exercise, token }) {
  const [exerciseUrl, setExerciseUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const startExercise = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/exercise/${exercise.id}/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // Enviar el token JWT
          },
        }
      );
      const data = await response.json();
      if (data.url) {
        setExerciseUrl(data.url);
      } else {
        alert(data.error || "Error starting the exercise");
      }
    } catch (error) {
      alert("Failed to connect to the backend");
    } finally {
      setLoading(false);
    }
  };

  const stopExercise = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/exercise/${exercise.id}/stop`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (data.message) {
        alert(data.message);
        setExerciseUrl(null);
      } else {
        alert(data.error || "Error stopping the exercise");
      }
    } catch (error) {
      alert("Failed to connect to the backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-4 mb-4">
      <h3 className="text-xl font-bold">{exercise.title}</h3>
      <p>{exercise.description}</p>
      {exerciseUrl ? (
        <div>
          <p>
            Access the exercise:{" "}
            <a href={exerciseUrl} target="_blank" rel="noopener noreferrer">
              {exerciseUrl}
            </a>
          </p>
          <button
            onClick={stopExercise}
            className="bg-red-500 text-white px-4 py-2 mt-2"
            disabled={loading}
          >
            Stop Exercise
          </button>
        </div>
      ) : (
        <button
          onClick={startExercise}
          className="bg-blue-500 text-white px-4 py-2"
          disabled={loading}
        >
          Start Exercise
        </button>
      )}
    </div>
  );
}

export default ExerciseManager;

import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

function Dashboard() {
  const { token } = useAuth();
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/exercises", {
          headers: {
            Authorization: `Bearer ${token}`, // Usa el token del contexto
          },
        });

        const data = await response.json();
        setExercises(data);
      } catch (error) {
        console.error("Error fetching exercises:", error);
      }
    };

    if (token) fetchExercises();
  }, [token]);

  const startExercise = async (exerciseId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/exercise/${exerciseId}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, // Incluye el token en la solicitud
        },
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Exercise started! Access it at: ${data.url}`);
      } else {
        alert(data.error || "Error starting exercise");
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-lg font-semibold">{exercise.title}</h2>
            <p className="text-sm text-gray-600 mb-4">{exercise.description}</p>
            <button
              onClick={() => startExercise(exercise.id)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Start Exercise
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;

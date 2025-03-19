import Link from "next/link";

function ExercisesList({ exercises, isAdmin, deleteExercise }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="card shadow-md hover:shadow-xl transition-shadow mb-4"
        >
          <h2 className="text-lg font-semibold mb-2">{exercise.title}</h2>
          <p className="text-sm mb-4">{exercise.description}</p>
          <Link href={`/exercises/${exercise.id}`}>
            <button
              className="px-4 py-2 rounded text-white bg-purple-700 hover:bg-purple-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600"
            >
              Ver detalle
            </button>
          </Link>
          {isAdmin && (
            <button
              onClick={() => deleteExercise(exercise.id)}
              className="ml-2 px-4 py-2 rounded text-white bg-red-700 hover:bg-red-800 transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600"
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default ExercisesList;

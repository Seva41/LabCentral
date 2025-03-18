import Link from "next/link";
import { FaSun, FaMoon } from "react-icons/fa";

export default function ExerciseHeader({
  exercise,
  containerStatus,
  startExercise,
  stopExercise,
  darkMode,
  toggleDarkMode,
  goBackToDashboard,
}) {
  return (
    <div className="card shadow space-y-4">
      <div className="flex justify-between items-center">
        {/* Botón para regresar (opcional) */}
        <button className="button bg-gray-600 hover:bg-gray-700" onClick={goBackToDashboard}>
          &larr; Volver al Dashboard
        </button>

        {/* Toggle dark mode */}
        <div className="flex items-center">
          <FaSun className={`mx-1 ${darkMode ? "opacity-50" : "opacity-100"}`} />
          <label className="relative inline-block w-10 h-6 mx-2">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <div className="w-10 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition"></div>
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-4 transition"></div>
          </label>
          <FaMoon className={`mx-1 ${darkMode ? "opacity-100" : "opacity-50"}`} />
        </div>
      </div>

      <h1 className="text-2xl font-bold">{exercise.title}</h1>
      <p>{exercise.description}</p>

      <div className="space-x-2">
        {containerStatus === "stopped" && (
          <button onClick={startExercise} className="button bg-green-600 hover:bg-green-700">
            Start
          </button>
        )}
        {containerStatus === "starting" && (
          <button disabled className="button bg-green-400 cursor-not-allowed">
            Starting...
          </button>
        )}
        {containerStatus === "running" && (
          <button onClick={stopExercise} className="button bg-red-600 hover:bg-red-700">
            Stop
          </button>
        )}
        {containerStatus === "stopping" && (
          <button disabled className="button bg-red-400 cursor-not-allowed">
            Stopping...
          </button>
        )}
      </div>
    </div>
  );
}

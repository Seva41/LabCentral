export default function ExerciseHeader({
  exercise,
  containerStatus,
  startExercise,
  stopExercise,
}) {
  return (
    <div className="card shadow space-y-4">
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

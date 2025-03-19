import { useRouter } from "next/router";
import { FaSun, FaMoon } from "react-icons/fa";
import useExerciseData from "@/hooks/useExerciseData";

import ExerciseHeader from "@/components/exercises/ExerciseHeader";
import ExerciseQuestions from "@/components/exercises/ExerciseQuestions";
import AdminPanel from "@/components/exercises/AdminPanel";

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  // Lógica y estados provienen de custom hook
  const {
    exercise,
    questions,
    containerStatus,
    startExercise,
    stopExercise,
    answers,
    handleAnswerChange,
    submitAnswer,
    myServerAnswers,
    isAdmin,
    newQuestion,
    setNewQuestion,
    exerciseZip,
    setExerciseZip,
    createQuestion,
    deleteQuestion,
    totalScore,

    editingQuestionId,
    editQuestionData,
    startEditingQuestion,
    cancelEditing,
    saveEditedQuestion,

    darkMode,
    toggleDarkMode,
    goBackToDashboard,
  } = useExerciseData(id, router);

  // Si todavía no cargó el ejercicio, mostramos mensaje
  if (!exercise) {
    return (
      <div className="p-4">
        <h2>Cargando ejercicio...</h2>
      </div>
    );
  }

  return (
    // Usamos un contenedor principal con min-h-screen.
    <div className={`layout min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : ""}`}>
      
      {/* Barra superior: botón volver + toggle dark mode */}
      <div className="p-4 flex justify-between items-center">
        <button
          onClick={goBackToDashboard}
          className="button button-gradient"
        >
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

      {/* Contenido principal centrado y con espaciado */}
      <div className="content w-full max-w-7xl mx-auto px-4 pb-24 space-y-6">
        
        {/* 1. Cabecera (título, desc, botones Start/Stop) */}
        <ExerciseHeader
          exercise={exercise}
          containerStatus={containerStatus}
          startExercise={startExercise}
          stopExercise={stopExercise}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          goBackToDashboard={goBackToDashboard}
        />

        {/* 2. Panel para crear preguntas (sólo si eres admin) */}
        {isAdmin && (
          <div className="max-w-3xl mx-auto">
            <AdminPanel
              newQuestion={newQuestion}
              setNewQuestion={setNewQuestion}
              exerciseZip={exerciseZip}
              setExerciseZip={setExerciseZip}
              createQuestion={createQuestion}
            />
          </div>
        )}

        {/* 3. Sección de preguntas (ancho distinto si prefieres) */}
        <div className="max-w-4xl mx-auto">
          <ExerciseQuestions
            questions={questions}
            answers={answers}
            handleAnswerChange={handleAnswerChange}
            submitAnswer={submitAnswer}
            myServerAnswers={myServerAnswers}
            isAdmin={isAdmin}
            deleteQuestion={deleteQuestion}
            editingQuestionId={editingQuestionId}
            editQuestionData={editQuestionData}
            startEditingQuestion={startEditingQuestion}
            cancelEditing={cancelEditing}
            saveEditedQuestion={saveEditedQuestion}
            totalScore={totalScore}
          />
        </div>

      </div>
    </div>
  );
}

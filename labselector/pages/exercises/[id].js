import { useRouter } from "next/router";
import useExerciseData from "@/hooks/useExerciseData";

import ExerciseHeader from "@/components/exercises/ExerciseHeader";
import ExerciseQuestions from "@/components/exercises/ExerciseQuestions";
import AdminPanel from "@/components/exercises/AdminPanel";

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query;

  // Lógica y estados se manejan en el hook
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

  // Si todavía no cargó el ejercicio
  if (!exercise) {
    return (
      <div className="p-4">
        <h2>Cargando ejercicio...</h2>
      </div>
    );
  }

  return (
    <div className={`${darkMode ? "bg-gray-900 text-gray-100" : "layout text-white"}`}>
      <div className="content px-4 pb-24 space-y-6">
        {/* 1. Cabecera (titulo, desc, Start/Stop) */}
        <ExerciseHeader
          exercise={exercise}
          containerStatus={containerStatus}
          startExercise={startExercise}
          stopExercise={stopExercise}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          goBackToDashboard={goBackToDashboard}
        />

        {/* 2. Sección de preguntas */}
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

        {/* 3. Panel para crear preguntas (solo admin) */}
        {isAdmin && (
          <AdminPanel
            newQuestion={newQuestion}
            setNewQuestion={setNewQuestion}
            exerciseZip={exerciseZip}
            setExerciseZip={setExerciseZip}
            createQuestion={createQuestion}
          />
        )}
      </div>
    </div>
  );
}

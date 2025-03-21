import { useRouter } from "next/router";
import { FaSun, FaMoon } from "react-icons/fa";
import Link from "next/link";
import { useState, useEffect } from "react";
import useExerciseData from "@/hooks/useExerciseData";

import ExerciseHeader from "@/components/exercises/ExerciseHeader";
import ExerciseQuestions from "@/components/exercises/ExerciseQuestions";
import AdminPanel from "@/components/exercises/AdminPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  // Estados y lógica del custom hook
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

  // Estado para almacenar la info del grupo del usuario
  const [myGroup, setMyGroup] = useState(null);

  useEffect(() => {
    if (!id) return;
    // Consultar el grupo del usuario para este ejercicio
    const fetchGroup = async () => {
      try {
        const res = await fetch(`${API_URL}/api/exercise/${id}/my_group`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          setMyGroup(data);
        }
      } catch (error) {
        console.error("Error al obtener grupo:", error);
      }
    };
    fetchGroup();
  }, [id]);

  if (!exercise) {
    return (
      <div className="p-4">
        <h2>Cargando ejercicio...</h2>
      </div>
    );
  }

  return (
    <div className={`layout min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : ""}`}>
      {/* Barra superior */}
      <div className="p-4 flex justify-between items-center">
        <button onClick={goBackToDashboard} className="button button-gradient">
          &larr; Volver al Dashboard
        </button>
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

      {/* Contenido principal */}
      <div className="content w-full max-w-7xl mx-auto px-4 pb-24 space-y-6">
        <ExerciseHeader
          exercise={exercise}
          containerStatus={containerStatus}
          startExercise={startExercise}
          stopExercise={stopExercise}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          goBackToDashboard={goBackToDashboard}
        />

        {/* Sección de grupo */}
        <div className="mt-4">
          {myGroup?.group_id ? (
            <div className="p-4 bg-green-100 text-green-900 rounded shadow">
              <h2 className="text-xl font-bold">Ya formas parte de un grupo</h2>
              <p><strong>Líder:</strong> {myGroup.leader.email}</p>
              <p><strong>Compañero:</strong> {myGroup.partner.email}</p>
            </div>
          ) : (
            <Link href={`/exercises/${id}/group`}>
              <button className="button button-gradient">
                Formar Grupo
              </button>
            </Link>
          )}
        </div>

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

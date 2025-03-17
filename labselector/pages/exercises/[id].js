import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FaSun, FaMoon } from "react-icons/fa";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [containerStatus, setContainerStatus] = useState("stopped"); // 'stopped', 'starting', 'running', 'stopping'

  // Respuestas que el usuario edita localmente antes de enviar
  const [answers, setAnswers] = useState({});
  // Respuestas ya enviadas al servidor
  const [myServerAnswers, setMyServerAnswers] = useState({});

  // Para saber si es admin
  const [isAdmin, setIsAdmin] = useState(false);

  // === Formulario para crear preguntas (admin) ===
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    score: 0,
    question_type: "abierta",
    choicesArray: [
      { id: 0, text: "", correct: false },
      { id: 1, text: "", correct: false },
    ],
  });

  // Para editar una pregunta existente
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState({
    question_text: "",
    question_type: "abierta",
    choices: "",
    score: 0,
  });

  // Estado para el modo oscuro
  const [darkMode, setDarkMode] = useState(false);

  // Al montar, leer la preferencia de modo oscuro desde localStorage
  useEffect(() => {
    const storedDarkMode = localStorage.getItem("darkMode");
    if (storedDarkMode === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Verificar usuario logueado y cargar datos del ejercicio y preguntas
  useEffect(() => {
    if (!id) return;

    const checkUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.error) {
          router.push("/login");
        } else {
          setIsAdmin(data.is_admin);
        }
      } catch (error) {
        console.error("Error checking user:", error);
        router.push("/login");
      }
    };

    const fetchExerciseDetail = async () => {
      try {
        const res = await fetch(`${API_URL}/api/exercise/${id}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!data.error) {
          setExercise(data);
        } else {
          console.error("Error fetching exercise detail:", data.error);
        }
      } catch (error) {
        console.error("Error fetching exercise detail:", error);
      }
    };

    const fetchQuestions = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/exercise/${id}/questions`,
          { credentials: "include" }
        );
        const data = await res.json();
        console.log("Preguntas recibidas:", data);
        if (!data.error) {
          setQuestions(data);
        } else {
          console.error("Error fetching questions:", data.error);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };

    const fetchMyAnswers = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/exercise/${id}/my_answers`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!data.error) {
          setMyServerAnswers(data);
        }
      } catch (error) {
        console.error("Error fetching my answers:", error);
      }
    };

    checkUser();
    fetchExerciseDetail();
    fetchQuestions();
    fetchMyAnswers();
  }, [id, router]);

  // Función para alternar modo oscuro y guardar la preferencia
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", newMode.toString());
  };

  // ===================== Start/Stop contenedor =====================
  const startExercise = async () => {
    setContainerStatus("starting");
    try {
      const response = await fetch(
        `${API_URL}/api/exercise/${id}/start`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await response.json();

      if (response.ok) {
        if (data.proxy_url) {
          setTimeout(() => {
            window.open(`${API_URL}${data.proxy_url}`, "_blank");
            setContainerStatus("running");
          }, 3000);
        } else {
          alert(data.message || "Exercise started");
          setContainerStatus("running");
        }
      } else {
        alert(data.error || "Failed to start exercise");
        setContainerStatus("stopped");
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
      alert("Error connecting to the backend");
      setContainerStatus("stopped");
    }
  };

  const stopExercise = async () => {
    setContainerStatus("stopping");
    try {
      const response = await fetch(
        `${API_URL}/api/exercise/${id}/stop`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Exercise stopped");
        setContainerStatus("stopped");
      } else {
        alert(data.error || "Failed to stop exercise");
        setContainerStatus("running");
      }
    } catch (error) {
      console.error("Error stopping exercise:", error);
      alert("Error connecting to the backend");
      setContainerStatus("running");
    }
  };

  // ===================== Manejo de respuestas de alumno =====================
  const handleAnswerChange = (questionId, text) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const submitAnswer = async (questionId) => {
    const answerText = answers[questionId] || "";
    if (!answerText.trim()) {
      alert("No puedes enviar una respuesta vacía.");
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/exercise/${id}/question/${questionId}/answer`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer_text: answerText }),
        }
      );
      const data = await res.json();

      if (res.ok) {
        alert("Respuesta enviada correctamente");
        setMyServerAnswers((prev) => ({
          ...prev,
          [questionId]: answerText,
        }));
      } else {
        alert(data.error || "No se pudo enviar la respuesta");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      alert("Error conectando con el backend");
    }
  };

  // ===================== Creación de pregunta (admin) =====================
  const addNewOption = () => {
    setNewQuestion((prev) => {
      const newId = prev.choicesArray.length;
      return {
        ...prev,
        choicesArray: [
          ...prev.choicesArray,
          { id: newId, text: "", correct: false },
        ],
      };
    });
  };

  const removeOption = (optionIndex) => {
    setNewQuestion((prev) => {
      const filtered = prev.choicesArray.filter((_, i) => i !== optionIndex);
      const reindexed = filtered.map((item, idx) => ({ ...item, id: idx }));
      return { ...prev, choicesArray: reindexed };
    });
  };

  const handleOptionTextChange = (optionIndex, newText) => {
    setNewQuestion((prev) => {
      const updated = [...prev.choicesArray];
      updated[optionIndex].text = newText;
      return { ...prev, choicesArray: updated };
    });
  };

  const markOptionAsCorrect = (optionIndex) => {
    setNewQuestion((prev) => {
      const updated = prev.choicesArray.map((opt, i) => ({
        ...opt,
        correct: i === optionIndex,
      }));
      return { ...prev, choicesArray: updated };
    });
  };

  const createQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      alert("La pregunta está vacía");
      return;
    }

    let finalChoices = "";
    if (newQuestion.question_type === "multiple_choice") {
      if (newQuestion.choicesArray.length < 2) {
        alert("Debe haber al menos 2 opciones en multiple_choice");
        return;
      }
      finalChoices = JSON.stringify(newQuestion.choicesArray);
    }

    const payload = {
      question_text: newQuestion.question_text,
      question_type: newQuestion.question_type,
      choices: newQuestion.question_type === "multiple_choice" ? finalChoices : "",
      score: newQuestion.score,
    };

    try {
      const res = await fetch(
        `${API_URL}/api/exercise/${id}/questions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Pregunta creada");
        setQuestions((prev) => [
          ...prev,
          {
            id: data.question_id,
            text: payload.question_text,
            type: payload.question_type,
            choices: payload.choices,
            score: payload.score,
          },
        ]);
        setNewQuestion({
          question_text: "",
          score: 0,
          question_type: "abierta",
          choicesArray: [
            { id: 0, text: "", correct: false },
            { id: 1, text: "", correct: false },
          ],
        });
      } else {
        alert(data.error || "No se pudo crear la pregunta");
      }
    } catch (error) {
      console.error("Error creating question:", error);
      alert("Error de conexión");
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!confirm("¿Estás seguro de eliminar esta pregunta?")) return;

    try {
      const res = await fetch(
        `${API_URL}/api/exercise/${id}/question/${questionId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Pregunta eliminada");
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      } else {
        alert(data.error || "No se pudo eliminar la pregunta");
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      alert("Error de conexión");
    }
  };

  const startEditingQuestion = (question) => {
    setEditingQuestionId(question.id);
    setEditQuestionData({
      question_text: question.text,
      question_type: question.type,
      choices: question.choices || "",
      score: question.score || 0,
    });
  };

  const cancelEditing = () => {
    setEditingQuestionId(null);
  };

  const saveEditedQuestion = async () => {
    if (!editQuestionData.question_text.trim()) {
      alert("La pregunta está vacía");
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/api/exercise/${id}/question/${editingQuestionId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editQuestionData),
        }
      );
      const data = await res.json();
      if (res.ok) {
        alert("Pregunta actualizada");
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestionId
              ? {
                  ...q,
                  text: editQuestionData.question_text,
                  type: editQuestionData.question_type,
                  choices: editQuestionData.choices,
                  score: editQuestionData.score,
                }
              : q
          )
        );
        setEditingQuestionId(null);
      } else {
        alert(data.error || "No se pudo actualizar la pregunta");
      }
    } catch (error) {
      console.error("Error updating question:", error);
      alert("Error de conexión");
    }
  };

  if (!exercise) {
    return (
      <div className="p-4">
        <h2>Cargando ejercicio...</h2>
      </div>
    );
  }

  // Calcular puntaje total sumando el puntaje de cada pregunta
  const totalScore = questions.reduce((total, q) => total + (q.score || 0), 0);

  return (
    // Envolvemos toda la página en un contenedor que cambia de colores según darkMode
    <div className={`${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"} min-h-screen`}>
      <div className="p-4 max-w-5xl mx-auto space-y-6">
        {/* Encabezado: Volver al Dashboard y switch de modo oscuro */}
        <div className="flex justify-between items-center">
          <Link href="/dashboard">
            <button className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">
              &larr; Volver al Dashboard
            </button>
          </Link>
          <div className="flex items-center">
            <FaSun className={`text-gray-600 dark:text-gray-300 ${darkMode ? "opacity-50" : "opacity-100"}`} />
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
            <FaMoon className={`text-gray-600 dark:text-gray-300 ${darkMode ? "opacity-100" : "opacity-50"}`} />
          </div>
        </div>

        {/* Detalle del ejercicio */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h1 className="text-2xl font-bold mb-2">{exercise.title}</h1>
          <p className="mb-4">{exercise.description}</p>
          <div className="space-x-2">
            {containerStatus === "stopped" && (
              <button
                onClick={startExercise}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Start
              </button>
            )}
            {containerStatus === "starting" && (
              <button
                disabled
                className="bg-blue-400 text-white px-4 py-2 rounded cursor-not-allowed"
              >
                Starting...
              </button>
            )}
            {containerStatus === "running" && (
              <button
                onClick={stopExercise}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
                Stop
              </button>
            )}
            {containerStatus === "stopping" && (
              <button
                disabled
                className="bg-yellow-400 text-white px-4 py-2 rounded cursor-not-allowed"
              >
                Stopping...
              </button>
            )}
          </div>
        </div>

        {/* Sección de preguntas */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Preguntas</h2>
          {questions.length === 0 && (
            <p className="text-gray-600">No hay preguntas configuradas.</p>
          )}
          {questions.map((q) => {
            const serverAnswer = myServerAnswers[q.id];
            const alreadyAnswered = Boolean(serverAnswer);

            return (
              <div
                key={q.id}
                className="border-b border-gray-200 dark:border-gray-700 py-4 flex flex-col md:flex-row md:items-center md:justify-between"
              >
                {editingQuestionId === q.id ? (
                  <div className="w-full">
                    <input
                      className="border w-full p-2 mb-2"
                      value={editQuestionData.question_text}
                      onChange={(e) =>
                        setEditQuestionData((prev) => ({
                          ...prev,
                          question_text: e.target.value,
                        }))
                      }
                    />
                    <label className="block mb-2">
                      <span className="text-sm">Puntaje:</span>
                      <input
                        type="number"
                        className="border p-2 w-full rounded"
                        value={editQuestionData.score}
                        onChange={(e) =>
                          setEditQuestionData((prev) => ({
                            ...prev,
                            score: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <select
                      className="border p-2 mb-2 block"
                      value={editQuestionData.question_type}
                      onChange={(e) =>
                        setEditQuestionData((prev) => ({
                          ...prev,
                          question_type: e.target.value,
                        }))
                      }
                    >
                      <option value="abierta">Abierta</option>
                      <option value="multiple_choice">Opción Múltiple</option>
                    </select>
                    {editQuestionData.question_type === "multiple_choice" && (
                      <textarea
                        className="border p-2 mb-2 w-full"
                        rows={3}
                        placeholder='Opciones separadas por línea o JSON (ej: ["op1", "op2"])'
                        value={editQuestionData.choices}
                        onChange={(e) =>
                          setEditQuestionData((prev) => ({
                            ...prev,
                            choices: e.target.value,
                          }))
                        }
                      />
                    )}
                    <div className="space-x-2">
                      <button
                        onClick={saveEditedQuestion}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 mb-2 md:mb-0">
                      <p className="font-medium">
                        {q.text}{" "}
                        <span className="text-sm text-gray-500">(Puntaje: {q.score})</span>
                      </p>
                      {q.type === "multiple_choice" && (
                        <div className="my-2">
                          {(() => {
                            if (!q.choices || !q.choices.trim()) {
                              return (
                                <p className="text-sm text-gray-500">
                                  No hay opciones configuradas.
                                </p>
                              );
                            }
                            let parsed = [];
                            try {
                              const data = JSON.parse(q.choices);
                              parsed = Array.isArray(data) ? data : [];
                            } catch (e) {
                              console.error("Error parseando choices:", e);
                              return (
                                <p className="text-sm text-red-500">
                                  Error al leer las opciones.
                                </p>
                              );
                            }
                            if (parsed.length === 0) {
                              return (
                                <p className="text-sm text-gray-500">
                                  No hay opciones configuradas.
                                </p>
                              );
                            }
                            const showCorrectLabel = isAdmin;
                            const disabled = alreadyAnswered;
                            const localAnswer = answers[q.id] || "";
                            return (
                              <div>
                                {parsed.map((opt) => {
                                  let label = opt.text;
                                  if (showCorrectLabel && opt.correct) {
                                    label += " (Correcta)";
                                  }
                                  const isChecked = alreadyAnswered
                                    ? serverAnswer === opt.text
                                    : localAnswer === opt.text;
                                  return (
                                    <label
                                      key={opt.id}
                                      className="flex items-center mb-1"
                                    >
                                      <input
                                        type="radio"
                                        name={`question-${q.id}`}
                                        checked={isChecked}
                                        disabled={disabled}
                                        onChange={() =>
                                          handleAnswerChange(q.id, opt.text)
                                        }
                                        className="mr-2"
                                      />
                                      {label}
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div className="mt-2">
                        {q.type === "abierta" && (
                          <>
                            {alreadyAnswered ? (
                              <>
                                <p className="text-sm text-green-700">
                                  Tu respuesta (modo lectura):
                                </p>
                                <textarea
                                  className="border w-full p-2 rounded mb-2"
                                  rows={2}
                                  disabled
                                  value={serverAnswer}
                                />
                              </>
                            ) : (
                              <>
                                <textarea
                                  className="border w-full p-2 rounded mb-2"
                                  rows={2}
                                  placeholder="Tu respuesta..."
                                  value={answers[q.id] || ""}
                                  onChange={(e) =>
                                    handleAnswerChange(q.id, e.target.value)
                                  }
                                />
                                <button
                                  onClick={() => submitAnswer(q.id)}
                                  className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                                >
                                  Enviar respuesta
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {q.type === "multiple_choice" && (
                          <>
                            {alreadyAnswered ? (
                              <p className="text-sm text-green-700">
                                Respuesta enviada: {serverAnswer}
                              </p>
                            ) : (
                              <button
                                onClick={() => submitAnswer(q.id)}
                                className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                              >
                                Enviar respuesta
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEditingQuestion(q)}
                          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {/* Mostrar puntaje total del ejercicio */}
          <div className="mt-4 p-4 bg-gray-200 dark:bg-gray-700 rounded">
            <p className="text-lg font-semibold">
              Puntaje total: {totalScore}
            </p>
          </div>
        </div>

        {/* Sección para crear nueva pregunta (admin) */}
        {isAdmin && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 border rounded">
            <h3 className="font-bold mb-2">Crear nueva pregunta</h3>
            <label className="block mb-2">
              <span className="text-sm">Texto de la pregunta:</span>
              <input
                type="text"
                className="border p-2 w-full rounded"
                value={newQuestion.question_text}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    question_text: e.target.value,
                  }))
                }
              />
            </label>
            <label className="block mb-2">
              <span className="text-sm">Puntaje:</span>
              <input
                type="number"
                className="border p-2 w-full rounded"
                value={newQuestion.score}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    score: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="block mb-2">
              <span className="text-sm">Tipo de pregunta:</span>
              <select
                className="border p-2 w-full rounded"
                value={newQuestion.question_type}
                onChange={(e) =>
                  setNewQuestion((prev) => ({
                    ...prev,
                    question_type: e.target.value,
                  }))
                }
              >
                <option value="abierta">Abierta</option>
                <option value="multiple_choice">Opción Múltiple</option>
              </select>
            </label>
            {newQuestion.question_type === "multiple_choice" && (
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 border rounded">
                <h4 className="font-semibold mb-2">Opciones</h4>
                {newQuestion.choicesArray.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.correct}
                      onChange={() => markOptionAsCorrect(idx)}
                      className="mr-2"
                    />
                    <input
                      type="text"
                      className="border p-1 rounded flex-1 mr-2"
                      placeholder={`Opción #${idx + 1}`}
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    />
                    {newQuestion.choicesArray.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="bg-red-500 text-white px-2 py-1 rounded"
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addNewOption}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Añadir opción
                </button>
              </div>
            )}
            <button
              onClick={createQuestion}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Crear Pregunta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Respuestas que el usuario está "editando" localmente antes de enviar
  // { [questionId]: "texto de respuesta" }
  const [answers, setAnswers] = useState({});

  // Respuestas que ya fueron enviadas y están guardadas en el servidor
  // { [questionId]: "texto de respuesta" }
  const [myServerAnswers, setMyServerAnswers] = useState({});

  // Verificar si el usuario es admin
  const [isAdmin, setIsAdmin] = useState(false);

  // === Formulario de creación de pregunta (admin) ===
  // choicesArray gestiona las opciones de multiple_choice en la UI
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    question_type: "abierta",
    choicesArray: [
      // Comenzamos con 2 opciones mínimas
      { id: 0, text: "", correct: false },
      { id: 1, text: "", correct: false },
    ],
  });

  // ID y datos para la edición de una pregunta existente (admin)
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState({
    question_text: "",
    question_type: "abierta",
    choices: "",
  });

  // Al montar o cambiar el id (ejercicio), cargamos la info inicial
  useEffect(() => {
    if (!id) return;

    // 1) Verificar usuario logueado y admin
    const checkUser = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/user", {
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

    // 2) Cargar detalle del ejercicio
    const fetchExerciseDetail = async () => {
      try {
        const res = await fetch(`http://localhost:5001/api/exercise/${id}`, {
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

    // 3) Cargar lista de preguntas
    const fetchQuestions = async () => {
      try {
        const res = await fetch(
          `http://localhost:5001/api/exercise/${id}/questions`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!data.error) {
          setQuestions(data);
        } else {
          console.error("Error fetching questions:", data.error);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };

    // 4) Cargar respuestas ya enviadas por el usuario (si las hay)
    const fetchMyAnswers = async () => {
      try {
        const res = await fetch(
          `http://localhost:5001/api/exercise/${id}/my_answers`,
          {
            credentials: "include",
          }
        );
        const data = await res.json();
        if (!data.error) {
          setMyServerAnswers(data); // { question_id: "respuesta" }
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

  // ===================== Start/Stop contenedor =====================
  const startExercise = async () => {
    setLoading(true);
    setStatusMessage("Iniciando contenedor...");

    try {
      const response = await fetch(
        `http://localhost:5001/api/exercise/${id}/start`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await response.json();

      if (response.ok) {
        if (data.proxy_url) {
          // Esperar 3s, luego abrir en otra pestaña
          setTimeout(() => {
            window.open(`http://localhost:5001${data.proxy_url}`, "_blank");
            setStatusMessage("");
            setLoading(false);
          }, 3000);
        } else {
          alert(data.message || "Exercise started");
          setStatusMessage("");
          setLoading(false);
        }
      } else {
        alert(data.error || "Failed to start exercise");
        setStatusMessage("");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
      alert("Error connecting to the backend");
      setStatusMessage("");
      setLoading(false);
    }
  };

  const stopExercise = async () => {
    setLoading(true);
    setStatusMessage("Deteniendo contenedor...");

    try {
      const response = await fetch(
        `http://localhost:5001/api/exercise/${id}/stop`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Exercise stopped");
      } else {
        alert(data.error || "Failed to stop exercise");
      }
    } catch (error) {
      console.error("Error stopping exercise:", error);
      alert("Error connecting to the backend");
    } finally {
      setStatusMessage("");
      setLoading(false);
    }
  };

  // ===================== Manejo de respuestas de alumno =====================
  // El user escribe localmente, lo guardamos en answers
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
        `http://localhost:5001/api/exercise/${id}/question/${questionId}/answer`,
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
        // Guardar en myServerAnswers para mostrar que ya está respondida
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
  // Añadir una nueva opción a choicesArray
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

  // Eliminar opción
  const removeOption = (optionIndex) => {
    setNewQuestion((prev) => {
      const filtered = prev.choicesArray.filter((_, i) => i !== optionIndex);
      // reindexar
      const reindexed = filtered.map((item, idx) => ({ ...item, id: idx }));
      return { ...prev, choicesArray: reindexed };
    });
  };

  // Cambiar el texto de una opción
  const handleOptionTextChange = (optionIndex, newText) => {
    setNewQuestion((prev) => {
      const updated = [...prev.choicesArray];
      updated[optionIndex].text = newText;
      return { ...prev, choicesArray: updated };
    });
  };

  // Marcar una opción como la correcta
  const markOptionAsCorrect = (optionIndex) => {
    setNewQuestion((prev) => {
      const updated = prev.choicesArray.map((opt, i) => ({
        ...opt,
        correct: i === optionIndex,
      }));
      return { ...prev, choicesArray: updated };
    });
  };

  // Crear la pregunta en el backend
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
      choices:
        newQuestion.question_type === "multiple_choice" ? finalChoices : "",
    };

    try {
      const res = await fetch(
        `http://localhost:5001/api/exercise/${id}/questions`,
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
        // Añadir a la lista local
        setQuestions((prev) => [
          ...prev,
          {
            id: data.question_id,
            text: payload.question_text,
            type: payload.question_type,
            choices: payload.choices,
          },
        ]);
        // Resetear formulario
        setNewQuestion({
          question_text: "",
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

  // ===================== Edición y eliminación de preguntas (admin) =====================
  const deleteQuestion = async (questionId) => {
    if (!confirm("¿Estás seguro de eliminar esta pregunta?")) return;

    try {
      const res = await fetch(
        `http://localhost:5001/api/exercise/${id}/question/${questionId}`,
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
        `http://localhost:5001/api/exercise/${id}/question/${editingQuestionId}`,
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

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Botón para volver al dashboard */}
      <div>
        <Link href="/dashboard">
          <button className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">
            &larr; Volver al Dashboard
          </button>
        </Link>
      </div>

      {/* Encabezado del ejercicio */}
      <div className="bg-white p-4 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">{exercise.title}</h1>
        <p className="mb-4">{exercise.description}</p>

        {/* Mensaje global de estado */}
        {statusMessage && (
          <div className="mb-4 flex items-center space-x-2">
            {loading && (
              <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Botones Start/Stop del contenedor */}
        <div className="space-x-2">
          <button
            onClick={startExercise}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Start
          </button>
          <button
            onClick={stopExercise}
            disabled={loading}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Sección de preguntas */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Preguntas</h2>
        {questions.length === 0 && (
          <p className="text-gray-600">No hay preguntas configuradas.</p>
        )}

        {/* Listado de preguntas */}
        {questions.map((q) => {
          // Revisamos si el usuario ya respondió esta pregunta
          const serverAnswer = myServerAnswers[q.id]; // string | undefined
          const alreadyAnswered = Boolean(serverAnswer);

          return (
            <div
              key={q.id}
              className="border-b border-gray-200 py-4 flex flex-col md:flex-row md:items-center md:justify-between"
            >
              {/* Si estamos editando esta pregunta (admin) */}
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
                // ==================== Vista normal (no edit) ====================
                <>
                  <div className="flex-1 mb-2 md:mb-0">
                    <p className="font-medium">{q.text}</p>

                    {/* multiple_choice => parseamos las opciones */}
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

                          return (
                            <div>
                              {parsed.map((opt) => {
                                let label = opt.text;
                                if (showCorrectLabel && opt.correct) {
                                  label += " (Correcta)";
                                }

                                // Chequear si ya respondió => radios deshabilitados
                                const disabled = alreadyAnswered;
                                // Marcamos el radio si coincide con la local (answers) o la guardada en el server
                                const localAnswer = answers[q.id] || "";
                                const isChecked =
                                  alreadyAnswered
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

                    {/* Sección de respuesta */}
                    <div className="mt-2">
                      {q.type === "abierta" && (
                        <>
                          {/* Si ya tiene respuesta en el server, mostrar textarea deshabilitado */}
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

                      {/* multiple_choice => botón de enviar */}
                      {q.type === "multiple_choice" && (
                        <>
                          {alreadyAnswered ? (
                            // Ya respondió, mostrar su respuesta
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

                  {/* Botones de edición/eliminación (solo admin) */}
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

        {/* Panel para crear nueva pregunta (solo admin) */}
        {isAdmin && (
          <div className="mt-4 p-4 bg-gray-50 border rounded">
            <h3 className="font-bold mb-2">Crear nueva pregunta</h3>
            {/* Texto de la pregunta */}
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

            {/* Tipo de pregunta */}
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

            {/* Opciones si es multiple_choice */}
            {newQuestion.question_type === "multiple_choice" && (
              <div className="mt-2 p-2 bg-white border rounded">
                <h4 className="font-semibold mb-2">Opciones</h4>
                {newQuestion.choicesArray.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center mb-2">
                    {/* Radio para marcar como correcta */}
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.correct}
                      onChange={() => markOptionAsCorrect(idx)}
                      className="mr-2"
                    />
                    {/* Texto de la opción */}
                    <input
                      type="text"
                      className="border p-1 rounded flex-1 mr-2"
                      placeholder={`Opción #${idx + 1}`}
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    />
                    {/* Eliminar opción (si tienes más de 2, por ejemplo) */}
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

                {/* Botón para añadir nueva opción */}
                <button
                  type="button"
                  onClick={addNewOption}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Añadir opción
                </button>
              </div>
            )}

            {/* Botón para crear la pregunta */}
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

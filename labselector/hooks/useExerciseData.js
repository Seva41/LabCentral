import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function useExerciseData(exerciseId, router) {
  /* -------------------- estados base -------------------- */
  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [containerStatus, setContainerStatus] = useState("stopped");
  const [answers, setAnswers] = useState({});
  const [myServerAnswers, setMyServerAnswers] = useState({});
  const [myGroupScores, setMyGroupScores] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  /* ---------- estados admin (crear / editar) ------------ */
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    score: 0,
    question_type: "abierta",
    choicesArray: [
      { id: 0, text: "", correct: false },
      { id: 1, text: "", correct: false },
    ],
  });
  const [exerciseZip, setExerciseZip] = useState(null);

  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState({
    question_text: "",
    question_type: "abierta",
    choices: "",
    score: 0,
  });

  /* -------------------- Dark‑mode ----------------------- */
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("darkMode") === "true";
    setDarkMode(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);
  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    document.documentElement.classList.toggle("dark", newVal);
    localStorage.setItem("darkMode", newVal.toString());
  };

  /* ------------------- carga inicial -------------------- */
  useEffect(() => {
    if (!exerciseId) return;

    const checkUser = async () => {
      const r = await fetch(`${API_URL}/api/user`, { credentials: "include" });
      const d = await r.json();
      if (d.error) return router.push("/login");
      setIsAdmin(d.is_admin);
    };

    const fetchExercise = () =>
      fetch(`${API_URL}/api/exercise/${exerciseId}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => !d.error && setExercise(d));

    const fetchQuestions = () =>
      fetch(`${API_URL}/api/exercise/${exerciseId}/questions`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => !d.error && setQuestions(d));

    const fetchMyAnswers = () =>
      fetch(`${API_URL}/api/exercise/${exerciseId}/my_answers`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => setMyServerAnswers(d));

    const fetchGroupScores = () =>
      fetch(`${API_URL}/api/exercise/${exerciseId}/my_group_scores`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => setMyGroupScores(d));

    checkUser();
    fetchExercise();
    fetchQuestions();
    fetchMyAnswers();
    fetchGroupScores();
  }, [exerciseId, router]);

  /* ---------------- contenedor docker ------------------ */
  const startExercise = async () => {
    setContainerStatus("starting");
    const r = await fetch(`${API_URL}/api/exercise/${exerciseId}/start`, {
      method: "POST",
      credentials: "include",
    });
    const d = await r.json();
    if (r.ok) {
      if (d.proxy_url) {
        setTimeout(() => {
          window.open(`${API_URL}${d.proxy_url}`, "_blank");
          setContainerStatus("running");
        }, 3000);
      } else setContainerStatus("running");
    } else {
      alert(d.error || "Error");
      setContainerStatus("stopped");
    }
  };

  const stopExercise = async () => {
    setContainerStatus("stopping");
    const r = await fetch(`${API_URL}/api/exercise/${exerciseId}/stop`, { 
      method: "POST", 
      credentials: "include" 
    });
    if (r.ok) {
      setContainerStatus("stopped");
    } else {
      setContainerStatus("running");
    }
  };

  async function checkContainerStatus() {
    try {
      const resp = await fetch(`${API_URL}/api/exercise/${exerciseId}/status`, {
        credentials: "include",
      });
      const data = await resp.json();
      // data.status = "running" | "stopped" | "not_found"...
      setContainerStatus(data.status || "stopped");
    } catch (error) {
      console.error("No se pudo obtener estado de contenedor:", error);
      setContainerStatus("stopped");
    }
  }

  /* ---------------- respuestas alumno ------------------ */
  const handleAnswerChange = (qid, text) =>
    setAnswers((prev) => ({ ...prev, [qid]: text }));

  const submitAnswer = async (qid) => {
    const text = answers[qid] || "";
    if (!text.trim()) return alert("Respuesta vacía");

    const r = await fetch(
      `${API_URL}/api/exercise/${exerciseId}/question/${qid}/answer`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: text }),
      }
    );
    const d = await r.json();
    if (r.ok) {
      alert("Respuesta enviada");
      setMyServerAnswers((p) => ({ ...p, [qid]: { answer_text: text } }));
    } else alert(d.error || "Error");
  };

  // === 5. Manejo de creación/edición de preguntas (Admin) ===
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
      const res = await fetch(`${API_URL}/api/exercise/${exerciseId}/questions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
        // Reset form
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
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!confirm("¿Estás seguro de eliminar esta pregunta?")) return;
    try {
      const res = await fetch(
        `${API_URL}/api/exercise/${exerciseId}/question/${questionId}`,
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
    }
  };

  // Editar pregunta
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
        `${API_URL}/api/exercise/${exerciseId}/question/${editingQuestionId}`,
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
    }
  };

  // === 6. Otras utilidades ===
  const goBackToDashboard = () => router.push("/dashboard");

  const totalScore = questions.reduce((acc, q) => acc + (q.score || 0), 0);

  return {
    exercise,
    questions,
    containerStatus,
    startExercise,
    stopExercise,
    answers,
    handleAnswerChange,
    submitAnswer,
    myServerAnswers,
    myGroupScores,
    isAdmin,
    newQuestion,
    setNewQuestion,
    exerciseZip,
    setExerciseZip,
    createQuestion,
    deleteQuestion,
    editingQuestionId,
    editQuestionData,
    setEditQuestionData,
    startEditingQuestion,
    cancelEditing,
    saveEditedQuestion,
    darkMode,
    toggleDarkMode,
    goBackToDashboard,
    totalScore,
  };
}

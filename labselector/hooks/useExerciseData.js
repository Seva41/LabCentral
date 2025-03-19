import { useEffect, useState } from "react";

export default function useExerciseData(exerciseId, router) {
  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [containerStatus, setContainerStatus] = useState("stopped"); 
  const [answers, setAnswers] = useState({});
  const [myServerAnswers, setMyServerAnswers] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin: Nuevo ejercicio (si lo necesitaras) y/o crear pregunta
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

  // Edición de pregunta
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState({
    question_text: "",
    question_type: "abierta",
    choices: "",
    score: 0,
  });

  // Dark Mode
  const [darkMode, setDarkMode] = useState(false);

  // === 1. Al montar, lee preferencia Dark Mode y verifica usuario logueado ===
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

  // === 2. Carga datos del usuario, ejercicio, preguntas, respuestas ===
  useEffect(() => {
    if (!exerciseId) return;

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
        const res = await fetch(`${API_URL}/api/exercise/${exerciseId}`, {
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
          `${API_URL}/api/exercise/${exerciseId}/questions`,
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

    const fetchMyAnswers = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/exercise/${exerciseId}/my_answers`,
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
  }, [exerciseId, router]);

  // === Manejo de modo oscuro ===
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

  // === 3. Manejo de contenedor (Start/Stop) ===
  const startExercise = async () => {
    setContainerStatus("starting");
    try {
      const response = await fetch(`${API_URL}/api/exercise/${exerciseId}/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        if (data.proxy_url) {
          setTimeout(() => {
            window.open(`${API_URL}${data.proxy_url}`, "_blank");
            setContainerStatus("running");
          }, 3000);
        } else {
          setContainerStatus("running");
        }
      } else {
        alert(data.error || "Failed to start exercise");
        setContainerStatus("stopped");
      }
    } catch (error) {
      console.error("Error starting exercise:", error);
      setContainerStatus("stopped");
    }
  };

  const stopExercise = async () => {
    setContainerStatus("stopping");
    try {
      const response = await fetch(`${API_URL}/api/exercise/${exerciseId}/stop`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        setContainerStatus("stopped");
      } else {
        alert(data.error || "Failed to stop exercise");
        setContainerStatus("running");
      }
    } catch (error) {
      console.error("Error stopping exercise:", error);
      setContainerStatus("running");
    }
  };

  // === 4. Manejo de respuestas (estudiante) ===
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
        `${API_URL}/api/exercise/${exerciseId}/question/${questionId}/answer`,
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
  const goBackToDashboard = () => {
    router.push("/dashboard");
  };

  // Cálculo de puntaje total
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
    isAdmin,
    newQuestion,
    setNewQuestion,
    exerciseZip,
    setExerciseZip,
    createQuestion,
    deleteQuestion,
    editingQuestionId,
    editQuestionData,
    startEditingQuestion,
    cancelEditing,
    saveEditedQuestion,
    darkMode,
    toggleDarkMode,
    goBackToDashboard,
    totalScore,
  };
}

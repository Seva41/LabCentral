export default function ExerciseQuestions({
    questions,
    answers,
    handleAnswerChange,
    submitAnswer,
    myServerAnswers,
    isAdmin,
    deleteQuestion,
    editingQuestionId,
    editQuestionData,
    startEditingQuestion,
    cancelEditing,
    saveEditedQuestion,
    totalScore,
    className = "",
  }) {
    return (
      <div className={`card shadow space-y-4 ${className}`}>
        <h2 className="text-xl font-semibold">Preguntas</h2>
  
        {questions.length === 0 && (
          <p className="text-gray-200">No hay preguntas configuradas.</p>
        )}
  
        {questions.map((q) => {
          const alreadyAnswered = Boolean(myServerAnswers[q.id]);
          const serverAnswer = myServerAnswers[q.id];
  
          // Modo edición (admin)
          if (editingQuestionId === q.id) {
            return (
              <div key={q.id} className="border-b border-white border-opacity-20 pb-4 mb-4">
                <input
                  className="input"
                  value={editQuestionData.question_text}
                  onChange={(e) =>
                    setEditQuestionData((prev) => ({
                      ...prev,
                      question_text: e.target.value,
                    }))
                  }
                />
                <label className="block mt-2">
                  <span className="text-sm">Puntaje:</span>
                  <input
                    type="number"
                    className="input"
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
                  className="input mt-2"
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
                {/* Si es multiple_choice, mostrar text area con JSON, etc. */}
                {editQuestionData.question_type === "multiple_choice" && (
                  <textarea
                    className="input mt-2"
                    rows={3}
                    placeholder='Opciones en JSON (ej: [{"text":"op1","correct":true}, ...])'
                    value={editQuestionData.choices}
                    onChange={(e) =>
                      setEditQuestionData((prev) => ({
                        ...prev,
                        choices: e.target.value,
                      }))
                    }
                  />
                )}
                <div className="space-x-2 mt-2">
                  <button
                    onClick={saveEditedQuestion}
                    className="button bg-green-600 hover:bg-green-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="button bg-gray-500 hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }
  
          // Modo lectura normal
          return (
            <div
              key={q.id}
              className="border-b border-white border-opacity-20 pb-4 mb-4 last:mb-0 last:border-b-0"
            >
              <p className="font-medium">
                {q.text}{" "}
                <span className="text-sm text-gray-300">
                  (Puntaje: {q.score || 0})
                </span>
              </p>
  
              {/* Ejemplo rápido para type=abierta o multiple_choice */}
              {q.type === "abierta" ? (
                <div className="mt-2">
                  {alreadyAnswered ? (
                    <>
                      <p className="text-green-200 text-sm">Tu respuesta:</p>
                      <textarea className="input" rows={2} disabled value={serverAnswer} />
                    </>
                  ) : (
                    <>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Tu respuesta..."
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      />
                      <button
                        onClick={() => submitAnswer(q.id)}
                        className="button button-gradient"
                      >
                        Enviar
                      </button>
                    </>
                  )}
                </div>
              ) : (
                // multiple_choice simplificado:
                <MultipleChoiceQuestion
                  q={q}
                  alreadyAnswered={alreadyAnswered}
                  serverAnswer={serverAnswer}
                  answers={answers}
                  handleAnswerChange={handleAnswerChange}
                  submitAnswer={submitAnswer}
                />
              )}
  
              {/* Botones admin (Editar/Eliminar) */}
              {isAdmin && (
                <div className="mt-2 space-x-2">
                  <button
                    onClick={() => startEditingQuestion(q)}
                    className="button bg-green-600 hover:bg-green-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="button bg-red-600 hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          );
        })}
  
        {/* Puntaje total */}
        <div className="card p-4 shadow">
          <p className="text-lg font-semibold">Puntaje total: {totalScore}</p>
        </div>
      </div>
    );
  }
  
  function MultipleChoiceQuestion({
    q,
    alreadyAnswered,
    serverAnswer,
    answers,
    handleAnswerChange,
    submitAnswer,
  }) {
    let parsedChoices = [];
    try {
      parsedChoices = q.choices ? JSON.parse(q.choices) : [];
      if (!Array.isArray(parsedChoices)) parsedChoices = [];
    } catch (err) {
    return <p className="text-sm text-red-200">Error al parsear choices: {err.message}</p>;
    }
  
    const localAnswer = answers[q.id] || "";
  
    return (
      <div className="mt-2">
        {parsedChoices.length < 1 && (
          <p className="text-sm text-gray-200">No hay opciones configuradas.</p>
        )}
  
        {parsedChoices.map((opt, idx) => {
          const isChecked = alreadyAnswered ? serverAnswer === opt.text : localAnswer === opt.text;
          return (
            <label key={idx} className="flex items-center mb-1">
              <input
                type="radio"
                className="mr-2"
                name={`question-${q.id}`}
                checked={isChecked}
                disabled={alreadyAnswered}
                onChange={() => handleAnswerChange(q.id, opt.text)}
              />
              {opt.text}
            </label>
          );
        })}
  
        {!alreadyAnswered && parsedChoices.length > 0 && (
          <button
            onClick={() => submitAnswer(q.id)}
            className="button button-gradient"
          >
            Enviar
          </button>
        )}
        {alreadyAnswered && (
          <p className="text-sm text-green-200">Respuesta enviada: {serverAnswer}</p>
        )}
      </div>
    );
  }
  
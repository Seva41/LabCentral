export default function ExerciseQuestions({
  questions,
  answers,
  handleAnswerChange,
  submitAnswer,
  myServerAnswers,  
  myGroupScores = {},  
  isAdmin,
  deleteQuestion,
  editingQuestionId,
  editQuestionData,
  setEditQuestionData,
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
        const indiv = myServerAnswers[q.id];
        const group = myGroupScores[q.id];

        // ---------- MODO EDICIÓN (ADMIN) ----------
        if (editingQuestionId === q.id) {
          return (
            <div
              key={q.id}
              className="border-b border-white border-opacity-20 pb-4 mb-4"
            >
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

        // ---------- MODO LECTURA ----------
        return (
          <div
            key={q.id}
            className="border-b border-white border-opacity-20 pb-4 mb-4 last:mb-0 last:border-b-0"
          >
            <p className="font-medium">
              {q.text}{" "}
              <span className="text-sm text-gray-300">(Puntaje: {q.score || 0})</span>
            </p>

            {/* -------- TIPO ABIERTA -------- */}
            {q.type === "abierta" ? (
              <OpenQuestion
                q={q}
                indiv={indiv}
                group={group}
                answers={answers}
                handleAnswerChange={handleAnswerChange}
                submitAnswer={submitAnswer}
              />
            ) : (
              /* -------- TIPO MULTIPLE CHOICE -------- */
              <MultipleChoiceQuestion
                q={q}
                indiv={indiv}
                group={group}
                answers={answers}
                handleAnswerChange={handleAnswerChange}
                submitAnswer={submitAnswer}
              />
            )}

            {/* Botones admin */}
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

/* ------------------------------------------------------------------ */
/* -----------------------   SUB‑COMPONENTES   ----------------------- */
/* ------------------------------------------------------------------ */

function OpenQuestion({
  q,
  indiv,
  group,
  answers,
  handleAnswerChange,
  submitAnswer,
}) {
  const answered = Boolean(indiv || group);
  const localAnswer = answers[q.id] || "";

  return (
    <div className="mt-2">
      {answered ? (
        <>
          <p className="text-green-200 text-sm mb-1">Tu respuesta:</p>
          <textarea className="input" rows={2} disabled
            value={indiv ? indiv.answer_text : group.answer_text} />

          {/* TARJETA INDIVIDUAL */}
          {indiv && (
            <div className="mt-2 rounded bg-green-50 p-2 text-sm text-green-800">
              <p><strong>Puntaje obtenido:</strong> {indiv.score ?? "Pendiente"}</p>
              {indiv.feedback && <p><strong>Feedback:</strong> {indiv.feedback}</p>}
            </div>
          )}

          {/* TARJETA GRUPAL */}
          {group && (
            <div className="mt-2 rounded bg-indigo-50 p-2 text-sm text-indigo-800">
              <p><strong>Puntaje grupal:</strong> {group.score ?? "Pendiente"}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <textarea
            className="input"
            rows={2}
            placeholder="Tu respuesta..."
            value={localAnswer}
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
  );
}

function MultipleChoiceQuestion({
  q,
  indiv,
  group,
  answers,
  handleAnswerChange,
  submitAnswer,
}) {
  let parsedChoices = [];
  try {
    parsedChoices = q.choices ? JSON.parse(q.choices) : [];
    if (!Array.isArray(parsedChoices)) parsedChoices = [];
  } catch (err) {
    return (
      <p className="text-sm text-red-200">
        Error al parsear choices: {err.message}
      </p>
    );
  }

  const localAnswer = answers[q.id] || "";
  const answered = Boolean(indiv || group);
  const serverAnswer = indiv ? indiv.answer_text : group?.answer_text;

  return (
    <div className="mt-2">
      {parsedChoices.length < 1 && (
        <p className="text-sm text-gray-200">No hay opciones configuradas.</p>
      )}

      {parsedChoices.map((opt, idx) => {
        const isChecked = answered
          ? serverAnswer === opt.text
          : localAnswer === opt.text;

        return (
          <label key={idx} className="flex items-center mb-1">
            <input
              type="radio"
              className="mr-2"
              name={`question-${q.id}`}
              checked={isChecked}
              disabled={answered}
              onChange={() => handleAnswerChange(q.id, opt.text)}
            />
            {opt.text}
          </label>
        );
      })}

      {!answered && parsedChoices.length > 0 && (
        <button
          onClick={() => submitAnswer(q.id)}
          className="button button-gradient"
        >
          Enviar
        </button>
      )}

      {answered && (
        <>
          <p className="mt-2 text-sm text-green-200">
            Respuesta enviada: {serverAnswer}
          </p>

          {indiv && (
            <div className="mt-2 rounded bg-green-50 p-2 text-sm text-green-800">
              <p><strong>Puntaje obtenido:</strong> {indiv.score ?? "Pendiente"}</p>
              {indiv.feedback && <p><strong>Feedback:</strong> {indiv.feedback}</p>}
            </div>
          )}

          {group && (
            <div className="mt-2 rounded bg-indigo-50 p-2 text-sm text-indigo-800">
              <p><strong>Puntaje grupal:</strong> {group.score ?? "Pendiente"}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

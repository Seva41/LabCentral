export default function AdminPanel({
    newQuestion,
    setNewQuestion,
    createQuestion,
  }) {
    // Funciones para opciones en multiple_choice
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
  
    return (
      <div className="card shadow space-y-4">
        <h3 className="text-xl font-semibold">Admin Panel - Crear nueva pregunta</h3>
        <label className="block">
          <span className="text-sm">Texto de la pregunta:</span>
          <input
            type="text"
            className="input mt-1"
            value={newQuestion.question_text}
            onChange={(e) =>
              setNewQuestion((prev) => ({ ...prev, question_text: e.target.value }))
            }
          />
        </label>
  
        <label className="block">
          <span className="text-sm">Puntaje:</span>
          <input
            type="number"
            className="input mt-1"
            value={newQuestion.score}
            onChange={(e) =>
              setNewQuestion((prev) => ({ ...prev, score: Number(e.target.value) }))
            }
          />
        </label>
  
        <label className="block">
          <span className="text-sm">Tipo de pregunta:</span>
          <select
            className="input mt-1"
            value={newQuestion.question_type}
            onChange={(e) =>
              setNewQuestion((prev) => ({ ...prev, question_type: e.target.value }))
            }
          >
            <option value="abierta">Abierta</option>
            <option value="multiple_choice">Opción Múltiple</option>
          </select>
        </label>
  
        {/* Múltiple choice: manejo de opciones */}
        {newQuestion.question_type === "multiple_choice" && (
          <div className="p-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded">
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
                  className="input flex-1 mr-2"
                  placeholder={`Opción #${idx + 1}`}
                  value={opt.text}
                  onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                />
                {newQuestion.choicesArray.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="button bg-red-600 hover:bg-red-700 px-2 py-1"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addNewOption}
              className="button button-gradient"
            >
              Añadir opción
            </button>
          </div>
        )}
  
        <button onClick={createQuestion} className="button button-gradient">
          Crear Pregunta
        </button>
      </div>
    );
  }
  
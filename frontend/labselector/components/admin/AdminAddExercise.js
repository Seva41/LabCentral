import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function AdminAddExercise({ refreshExercises }) {
  const [newExercise, setNewExercise] = useState({ title: "", description: "" });
  const [exerciseZip, setExerciseZip] = useState(null);

  const addExerciseWithZip = async () => {
    if (!exerciseZip) {
      alert("Please select a ZIP file first.");
      return;
    }
    const formData = new FormData();
    formData.append("title", newExercise.title);
    formData.append("description", newExercise.description);
    formData.append("zipfile", exerciseZip);

    try {
      const response = await fetch(`${API_URL}/api/exercise_with_zip`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.ok) {
        alert("Exercise added successfully");
        refreshExercises();
        setNewExercise({ title: "", description: "" });
        setExerciseZip(null);
      } else {
        alert("Failed to add exercise");
      }
    } catch (error) {
      console.error("Error adding exercise with zip:", error);
    }
  };

  return (
    <div className="card mb-6 p-4">
      <h2 className="text-lg font-semibold mb-4">Agregar Ejercicio (Admin)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Exercise Title"
          value={newExercise.title}
          onChange={(e) =>
            setNewExercise({ ...newExercise, title: e.target.value })
          }
          className="input"
        />
        <input
          type="text"
          placeholder="Description"
          value={newExercise.description}
          onChange={(e) =>
            setNewExercise({ ...newExercise, description: e.target.value })
          }
          className="input"
        />
        <input
          type="file"
          accept=".zip"
          onChange={(e) => {
            if (e.target.files.length > 0) {
              setExerciseZip(e.target.files[0]);
            } else {
              setExerciseZip(null);
            }
          }}
          className="input"
        />
      </div>
      <button
        onClick={addExerciseWithZip}
        className="button button-gradient"
      >
        Add Exercise (ZIP)
      </button>
    </div>
  );
}

export default AdminAddExercise;

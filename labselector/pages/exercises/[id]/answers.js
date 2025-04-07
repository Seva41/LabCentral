import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

/**
 * Vista de evaluación (sólo administradores).
 * Permite listar, calificar y dejar feedback a las respuestas
 * individuales y grupales de un ejercicio.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ExerciseAnswers() {
  const router = useRouter();
  const { id } = router.query; // id del ejercicio

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [individual, setIndividual] = useState([]); // respuestas individuales
  const [groups, setGroups] = useState([]); // respuestas grupales

  // Estados locales para edición
  const [indivScore, setIndivScore] = useState({}); // {answerId: score}
  const [indivFeedback, setIndivFeedback] = useState({}); // {answerId: feedback}
  const [groupScore, setGroupScore] = useState({}); // {answerId: score}

  // ---------------- Helpers ----------------
  const fetchAnswers = () => {
    setLoading(true);
    fetch(`${API_URL}/api/admin/exercise/${id}/answers`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status !== 200) throw new Error('No se pudieron obtener datos');
        const data = await res.json();
        setIndividual(data.individual_answers || []);
        setGroups(data.group_answers || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const patchAnswer = async (mode, answerId, payload) => {
    const res = await fetch(`${API_URL}/api/admin/answer/${mode}/${answerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al guardar');
    }
  };

  // ---------------- Effects ----------------
  useEffect(() => {
    if (!id) return; // espera al parámetro

    // 1) verificar rol admin
    fetch(`${API_URL}/api/user`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status !== 200) throw new Error('No autorizado');
        const data = await res.json();
        if (!data.is_admin) {
          router.replace('/dashboard');
          throw new Error('No es admin');
        }
      })
      // 2) obtener respuestas
      .then(fetchAnswers)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------- Guardar cambios ----------------
  const handleSaveIndividual = async (ans) => {
    const score = indivScore[ans.answer_id];
    const feedback = indivFeedback[ans.answer_id];
    try {
      await patchAnswer('individual', ans.answer_id, {
        score: score === '' ? null : Number(score),
        feedback,
      });
      fetchAnswers();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSaveGroup = async (ans) => {
    const score = groupScore[ans.answer_id];
    try {
      await patchAnswer('group', ans.answer_id, {
        score: score === '' ? null : Number(score),
      });
      fetchAnswers();
    } catch (e) {
      alert(e.message);
    }
  };

  // ---------------- Render ----------------
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-lg font-semibold">Cargando…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      {/* Botón volver */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="button button-gradient">
          &larr; Volver
        </button>
      </div>

      <h1 className="mb-8 text-3xl font-bold">Respuestas del ejercicio #{id}</h1>

      {/* INDIVIDUALES */}
      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-semibold">
          Respuestas individuales ({individual.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl shadow">
          <table className="min-w-full divide-y divide-gray-200 bg-white text-sm text-gray-800">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Alumno</th>
                <th className="px-4 py-2 text-left">Pregunta</th>
                <th className="px-4 py-2 text-left">Respuesta</th>
                <th className="px-4 py-2 text-left">Puntaje</th>
                <th className="px-4 py-2 text-left">Feedback</th>
                <th className="px-4 py-2 text-left">Guardar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {individual.map((ans) => (
                <tr key={ans.answer_id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2">{ans.user.email}</td>
                  <td className="px-4 py-2">{ans.question_text}</td>
                  <td className="px-4 py-2 max-w-xs break-words">{ans.answer_text}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-20 rounded border px-1 py-0.5"
                      value={
                        indivScore[ans.answer_id] !== undefined
                          ? indivScore[ans.answer_id]
                          : ans.score ?? ''
                      }
                      onChange={(e) =>
                        setIndivScore({
                          ...indivScore,
                          [ans.answer_id]: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <textarea
                      rows={2}
                      className="w-full rounded border px-2 py-1"
                      value={
                        indivFeedback[ans.answer_id] !== undefined
                          ? indivFeedback[ans.answer_id]
                          : ans.feedback ?? ''
                      }
                      onChange={(e) =>
                        setIndivFeedback({
                          ...indivFeedback,
                          [ans.answer_id]: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                      onClick={() => handleSaveIndividual(ans)}
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GRUPALES */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">
          Respuestas grupales ({groups.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl shadow">
          <table className="min-w-full divide-y divide-gray-200 bg-white text-sm text-gray-800">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Grupo</th>
                <th className="px-4 py-2 text-left">Integrantes</th>
                <th className="px-4 py-2 text-left">Pregunta</th>
                <th className="px-4 py-2 text-left">Respuesta</th>
                <th className="px-4 py-2 text-left">Puntaje</th>
                <th className="px-4 py-2 text-left">Guardar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((ans) => (
                <tr key={ans.answer_id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2">#{ans.group.id}</td>
                  <td className="px-4 py-2">
                    {ans.group.leader_email}
                    {ans.group.partner_email ? `, ${ans.group.partner_email}` : ''}
                  </td>
                  <td className="px-4 py-2 max-w-xs break-words">{ans.question_text}</td>
                  <td className="px-4 py-2 max-w-xs break-words">{ans.answer_text}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-20 rounded border px-1 py-0.5"
                      value={
                        groupScore[ans.answer_id] !== undefined
                          ? groupScore[ans.answer_id]
                          : ans.score ?? ''
                      }
                      onChange={(e) =>
                        setGroupScore({
                          ...groupScore,
                          [ans.answer_id]: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                      onClick={() => handleSaveGroup(ans)}
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

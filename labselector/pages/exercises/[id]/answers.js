import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';

/**
 * Vista de evaluación (sólo administradores) con soporte Dark Mode.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ExerciseAnswers() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [individual, setIndividual] = useState([]);
  const [groups, setGroups] = useState([]);

  // Edición local
  const [indivScore, setIndivScore] = useState({});
  const [indivFeedback, setIndivFeedback] = useState({});
  const [groupScore, setGroupScore] = useState({});

  /* ---------------- helpers ---------------- */
  const fetchAnswers = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/admin/exercise/${id}/answers`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('No se pudieron obtener datos');
        const d = await r.json();
        // Se espera que el backend retorne individual_answers y group_answers
        setIndividual(d.individual_answers || []);
        setGroups(d.group_answers || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const patchAnswer = async (mode, answerId, payload) => {
    const r = await fetch(`${API_URL}/api/admin/answer/${mode}/${answerId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const d = await r.json();
      throw new Error(d.error || 'Error al guardar');
    }
  };

  /* ---------------- effects ---------------- */
  useEffect(() => {
    if (!id) return;

    const verifyAdminAndLoad = async () => {
      try {
        const r = await fetch(`${API_URL}/api/user`, { credentials: 'include' });
        if (!r.ok) throw new Error('No autorizado');
        const u = await r.json();
        if (!u.is_admin) {
          router.replace('/dashboard');
          return;
        }
        fetchAnswers();
      } catch (e) {
        setError(e.message);
      }
    };

    verifyAdminAndLoad();
  }, [id, router, fetchAnswers]);

  /* -------------- guardar cambios ------------- */
  const handleSaveIndividual = async (ans) => {
    try {
      await patchAnswer('individual', ans.answer_id, {
        score: indivScore[ans.answer_id] === '' ? null : Number(indivScore[ans.answer_id]),
        feedback: indivFeedback[ans.answer_id],
      });
      fetchAnswers();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSaveGroup = async (ans) => {
    try {
      await patchAnswer('group', ans.answer_id, {
        score: groupScore[ans.answer_id] === '' ? null : Number(groupScore[ans.answer_id]),
      });
      fetchAnswers();
    } catch (e) {
      alert(e.message);
    }
  };

  /* ---------------- render ---------------- */
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
        <span className="text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      {/* Botón para volver */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="button button-gradient">
          &larr; Volver
        </button>
      </div>

      <h1 className="mb-8 text-3xl font-bold">Respuestas del ejercicio #{id}</h1>

      <AnswersTable
        title="Respuestas individuales"
        rows={individual}
        scoreState={indivScore}
        setScoreState={setIndivScore}
        feedbackState={indivFeedback}
        setFeedbackState={setIndivFeedback}
        onSave={handleSaveIndividual}
        type="individual"
      />

      <AnswersTable
        title="Respuestas grupales"
        rows={groups}
        scoreState={groupScore}
        setScoreState={setGroupScore}
        onSave={handleSaveGroup}
        type="group"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function AnswersTable({
  title,
  rows,
  scoreState,
  setScoreState,
  feedbackState = {},
  setFeedbackState = () => {},
  onSave,
  type,
}) {
  const isGroup = type === 'group';
  return (
    <section className={isGroup ? '' : 'mb-16'}>
      <h2 className="mb-4 text-2xl font-semibold">
        {title} ({rows.length})
      </h2>
      <div className="overflow-x-auto rounded-2xl shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
            <tr>
              {isGroup ? (
                <>
                  <Th>Grupo</Th>
                  <Th>Integrantes</Th>
                </>
              ) : (
                <Th>Alumno</Th>
              )}
              <Th>Pregunta</Th>
              <Th>Respuesta</Th>
              <Th>Puntaje</Th>
              {!isGroup && <Th>Feedback</Th>}
              <Th>Guardar</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ans) => (
              <tr key={ans.answer_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {isGroup ? (
                  <>
                    <Td>#{ans.group?.id || '-'}</Td>
                    <Td>
                      {ans.group?.leader_email || '-'} 
                      {ans.group?.partner_email ? `, ${ans.group.partner_email}` : ''}
                    </Td>
                  </>
                ) : (
                  <Td>{ans.user?.email || '-'}</Td>
                )}
                {/* Si el objeto no trae question_text, se utiliza un placeholder */}
                <Td className="max-w-xs break-words">
                  {ans.question_text || `Pregunta #${ans.question_id}`}
                </Td>
                <Td className="max-w-xs break-words">{ans.answer_text}</Td>
                <Td>
                  <input
                    type="number"
                    className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1 py-0.5 text-gray-800 dark:text-gray-100"
                    value={scoreState[ans.answer_id] ?? ans.score ?? ''}
                    onChange={(e) =>
                      setScoreState({ ...scoreState, [ans.answer_id]: e.target.value })
                    }
                  />
                </Td>
                {!isGroup && (
                  <Td>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-800 dark:text-gray-100"
                      value={feedbackState[ans.answer_id] ?? ans.feedback ?? ''}
                      onChange={(e) =>
                        setFeedbackState({
                          ...feedbackState,
                          [ans.answer_id]: e.target.value,
                        })
                      }
                    />
                  </Td>
                )}
                <Td className="text-center">
                  <button
                    className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                    onClick={() => onSave(ans)}
                  >
                    Guardar
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const Th = ({ children }) => <th className="px-4 py-2 text-left font-medium">{children}</th>;
const Td = ({ children, className = '' }) => <td className={`px-4 py-2 whitespace-nowrap ${className}`}>{children}</td>;

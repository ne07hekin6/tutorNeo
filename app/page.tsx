"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

type TaskConfig = {
  topic: string;
  objective: string;
  subject: string;
  grade: string;
  durationMin: string;
};

type StudentProfile = {
  name: string;
  age: string;
  course: string;
  strengths: string;
  challenges: string;
};

type Evaluation = {
  status: "Aprobado" | "En proceso";
  score: number;
  weakConcepts: string[];
  nextActions: string[];
  summary?: string;
  updatedAt?: number;
};

type ApiConfig = {
  useLiveApi: boolean;
  apiKey: string;
  model: string;
};

const DEFAULT_TASK: TaskConfig = {
  topic: "Ciclo del agua",
  objective:
    "Comprender evaporacion, condensacion y precipitacion con ejemplos reales",
  subject: "Ciencias Naturales",
  grade: "5to grado",
  durationMin: "10",
};

const DEFAULT_STUDENT: StudentProfile = {
  name: "Sofia R.",
  age: "10",
  course: "5to A",
  strengths: "Relaciona ejemplos cotidianos",
  challenges: "Vocabulario tecnico",
};

const DEFAULT_PROMPT = `Eres TutorNeo, un tutor conversacional para primaria.
Tu objetivo es validar comprensión real, no memorizacion.
Haz preguntas abiertas, pide ejemplos concretos y razonamiento.
Cuando haya errores, guia con pistas y contraejemplos.
Evita dar la respuesta completa en la primera respuesta.
Cierra con un mini resumen y un siguiente paso.`;

const DEFAULT_API: ApiConfig = {
  useLiveApi: true,
  apiKey: "",
  model: "gpt-4.1-mini",
};

const SEED_MESSAGES: Message[] = [];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    setValue(safeParse(stored, initialValue));
    setHydrated(true);
  }, [key, initialValue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated] as const;
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function Home() {
  const [taskConfig, setTaskConfig, taskHydrated] =
    useLocalStorageState<TaskConfig>("tutorneo.taskConfig", DEFAULT_TASK);
  const [student, setStudent, studentHydrated] =
    useLocalStorageState<StudentProfile>(
      "tutorneo.studentProfile",
      DEFAULT_STUDENT,
    );
  const [systemPrompt] = useLocalStorageState(
    "tutorneo.systemPrompt",
    DEFAULT_PROMPT,
  );
  const [messages, setMessages] = useLocalStorageState<Message[]>(
    "tutorneo.messages",
    SEED_MESSAGES,
  );
  const [evaluation, setEvaluation] = useLocalStorageState<Evaluation | null>(
    "tutorneo.evaluation",
    null,
  );
  const [apiConfig, setApiConfig] = useLocalStorageState<ApiConfig>(
    "tutorneo.api",
    DEFAULT_API,
  );
  const [theme, setTheme] = useLocalStorageState<"light" | "dark">(
    "tutorneo.theme",
    "light",
  );
  const [taskDraft, setTaskDraft] = useState(taskConfig);
  const [studentDraft, setStudentDraft] = useState(student);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [apiError, setApiError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (taskHydrated) setTaskDraft(taskConfig);
  }, [taskConfig, taskHydrated]);

  useEffect(() => {
    if (studentHydrated) setStudentDraft(student);
  }, [student, studentHydrated]);

  useEffect(() => {
    if (!apiConfig.useLiveApi) {
      setApiConfig({ ...apiConfig, useLiveApi: true });
    }
  }, [apiConfig, setApiConfig]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const taskDirty =
    JSON.stringify(taskDraft) !== JSON.stringify(taskConfig);
  const studentDirty =
    JSON.stringify(studentDraft) !== JSON.stringify(student);

  const hasEvaluation = Boolean(evaluation);
  const statusTone = hasEvaluation
    ? evaluation?.status === "Aprobado"
      ? "bg-emerald-500/25 text-white border-emerald-400 dark:bg-emerald-400/25 dark:text-white dark:border-emerald-500/40"
      : "bg-amber-100/60 text-amber-900 border-amber-900/70 dark:bg-transparent dark:text-[#f4d66a] dark:border-[#d9b95b]"
    : "bg-[color:var(--soft)] text-[color:var(--accent-2)] border-[color:var(--line)] dark:bg-[color:var(--panel-bg)] dark:text-[color:var(--accent)] dark:border-[color:var(--line)]";

  const progressWidth = `${evaluation?.score ?? 0}%`;

  async function requestTutorReply(nextMessages: Message[], start = false) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        systemPrompt,
        model: apiConfig.model,
        apiKey: apiConfig.apiKey,
        taskConfig,
        student,
        start,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error?.error || "Error en la API");
    }
    return response.json();
  }

  async function handleSend() {
    if (!input.trim() || isSending) return;
    if (!apiConfig.useLiveApi) {
      setApiError("La API en vivo esta desactivada. Activala para responder.");
      return;
    }

    setApiError("");
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: input.trim(),
      ts: Date.now(),
    };
    setInput("");

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    setIsSending(true);
    try {
      const data = await requestTutorReply(nextMessages);
      const replyText = data.text || "Sin respuesta";

      const assistantMessage: Message = {
        id: makeId(),
        role: "assistant",
        content: replyText,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.evaluation) {
        setEvaluation({
          ...data.evaluation,
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No se pudo contactar la API",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleStartConversation() {
    if (isSending) return;
    if (!apiConfig.useLiveApi) {
      setApiError("La API en vivo esta desactivada. Activala para iniciar.");
      return;
    }

    setApiError("");
    setIsSending(true);
    try {
      const data = await requestTutorReply(messages, true);
      const replyText = data.text || "Sin respuesta";

      const assistantMessage: Message = {
        id: makeId(),
        role: "assistant",
        content: replyText,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.evaluation) {
        setEvaluation({
          ...data.evaluation,
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No se pudo contactar la API",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleResetChat() {
    setMessages([]);
    setEvaluation(null);
    setApiError("");
  }

  return (
    <div className="h-screen overflow-hidden px-6 py-6">
      <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6">
        <header className="glass-card flex flex-col gap-4 border border-[var(--line)] px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="panel-lite rounded-2xl border p-2 shadow-sm">
                <Image
                  src={
                    theme === "dark"
                      ? "/logoNeoTransparenteLight.png"
                      : "/logoNeoTransparente.png"
                  }
                  alt="Neo Sistema Educativo"
                  width={120}
                  height={48}
                  className="h-8 w-auto"
                  priority
                />
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--accent-2)]">
                Neo Sistema Educativo
              </p>
            </div>
            <h1 className="font-display mt-3 text-3xl text-[color:var(--ink)] md:text-4xl">
              TutorNeo · Tarea conversacional en casa
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)] md:text-base">
              Validamos comprensión real con conversación guiada y diagnóstico
              inmediato.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip rounded-full border px-3 py-1 text-xs">
              Duracion estimada: 8-12 min
            </span>
            <span className="chip rounded-full border px-3 py-1 text-xs">
              Configuracion docente: 30s
            </span>
            <span className="chip rounded-full border px-3 py-1 text-xs text-[color:var(--ink)]">
              POC UI
            </span>
            <button
              className="chip rounded-full border px-3 py-1 text-xs transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              type="button"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(520px,2.3fr)_minmax(280px,1fr)]">
          <section className="scrollbar-neo flex min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="glass-card p-5">
              <h2 className="font-display text-lg">Configuracion de tarea</h2>
              <p className="text-xs text-[color:var(--muted)]">
                Tema + objetivo en dos renglones. Impacta en el testeo cuando
                guardas.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Tema
                </label>
                <input
                  className="field w-full rounded-xl border px-3 py-2 text-sm"
                  value={taskDraft.topic}
                  onChange={(event) =>
                    setTaskDraft({ ...taskDraft, topic: event.target.value })
                  }
                />
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Objetivo
                </label>
                <textarea
                  className="field min-h-[80px] w-full rounded-xl border px-3 py-2 text-sm"
                  value={taskDraft.objective}
                  onChange={(event) =>
                    setTaskDraft({
                      ...taskDraft,
                      objective: event.target.value,
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Materia
                    </label>
                    <input
                      className="field mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                      value={taskDraft.subject}
                      onChange={(event) =>
                        setTaskDraft({
                          ...taskDraft,
                          subject: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Grado
                    </label>
                    <input
                      className="field mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                      value={taskDraft.grade}
                      onChange={(event) =>
                        setTaskDraft({
                          ...taskDraft,
                          grade: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Duracion (min)
                  </label>
                  <input
                    className="field mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    value={taskDraft.durationMin}
                    onChange={(event) =>
                      setTaskDraft({
                        ...taskDraft,
                        durationMin: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`text-xs ${
                    taskDirty ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {taskDirty ? "Cambios sin guardar" : "Guardado"}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[color:var(--muted)] disabled:opacity-40"
                    type="button"
                    onClick={() => setTaskDraft(taskConfig)}
                    disabled={!taskDirty}
                  >
                    Descartar
                  </button>
                  <button
                    className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs text-white shadow disabled:opacity-40"
                    type="button"
                    onClick={() => setTaskConfig(taskDraft)}
                    disabled={!taskDirty}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-display text-lg">Perfil del alumno</h2>
              <p className="text-xs text-[color:var(--muted)]">
                Datos livianos para contextualizar el dialogo. Impacta en el
                testeo cuando guardas.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Nombre
                </label>
                <input
                  className="field w-full rounded-xl border px-3 py-2 text-sm"
                  value={studentDraft.name}
                  onChange={(event) =>
                    setStudentDraft({
                      ...studentDraft,
                      name: event.target.value,
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Edad
                    </label>
                    <input
                      className="field mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                      value={studentDraft.age}
                      onChange={(event) =>
                        setStudentDraft({
                          ...studentDraft,
                          age: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Curso
                    </label>
                    <input
                      className="field mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                      value={studentDraft.course}
                      onChange={(event) =>
                        setStudentDraft({
                          ...studentDraft,
                          course: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Fortalezas
                </label>
                <input
                  className="field w-full rounded-xl border px-3 py-2 text-sm"
                  value={studentDraft.strengths}
                  onChange={(event) =>
                    setStudentDraft({
                      ...studentDraft,
                      strengths: event.target.value,
                    })
                  }
                />
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Dificultades
                </label>
                <input
                  className="field w-full rounded-xl border px-3 py-2 text-sm"
                  value={studentDraft.challenges}
                  onChange={(event) =>
                    setStudentDraft({
                      ...studentDraft,
                      challenges: event.target.value,
                    })
                  }
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`text-xs ${
                    studentDirty ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {studentDirty ? "Cambios sin guardar" : "Guardado"}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[color:var(--muted)] disabled:opacity-40"
                    type="button"
                    onClick={() => setStudentDraft(student)}
                    disabled={!studentDirty}
                  >
                    Descartar
                  </button>
                  <button
                    className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs text-white shadow disabled:opacity-40"
                    type="button"
                    onClick={() => setStudent(studentDraft)}
                    disabled={!studentDirty}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>

          </section>

          <section className="scrollbar-neo flex min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="glass-card flex min-h-[420px] flex-col p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg">
                    Conversacion con el alumno
                  </h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    Tarea activa: {taskConfig.topic} · {taskConfig.grade}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length === 0 && (
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                      type="button"
                      onClick={handleStartConversation}
                      disabled={isSending}
                    >
                      Iniciar tutor
                    </button>
                  )}
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    type="button"
                    onClick={handleResetChat}
                  >
                    Reset chat
                  </button>
                </div>
              </div>
              <div
                ref={chatScrollRef}
                className="scrollbar-neo mt-4 flex-1 space-y-3 overflow-y-auto pr-2"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.role === "assistant"
                        ? "bubble-assistant"
                        : "ml-auto bg-[color:var(--accent)]/15 text-[color:var(--ink)]"
                    }`}
                  >
                    <p className="text-[13px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {message.role === "assistant" ? "Tutor" : "Alumno"}
                    </p>
                    <p className="mt-2 text-[15px] leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                ))}
                {isSending && (
                  <div className="bubble-muted max-w-[70%] rounded-2xl px-4 py-3 text-sm">
                    TutorNeo esta pensando...
                  </div>
                )}
              </div>
              {apiError && (
                <p className="mt-2 text-xs text-rose-600">{apiError}</p>
              )}
              <div className="mt-4 flex items-center gap-3">
                <input
                  className="field flex-1 rounded-2xl border px-4 py-3 text-sm"
                  placeholder="Escribi la respuesta del alumno..."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSend();
                  }}
                />
                <button
                  className="rounded-2xl bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/40 transition hover:-translate-y-[1px] disabled:opacity-60"
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                >
                  Enviar
                </button>
              </div>
            </div>

            
          </section>

          <section className="scrollbar-neo flex min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="glass-card p-5">
              <h2 className="font-display text-lg">Evidencia de comprensión</h2>
              <p className="text-xs text-[color:var(--muted)]">
                Diagnóstico generado por el tutor en base a la conversación.
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone}`}
                  >
                    {evaluation?.status ?? "Sin evaluar"}
                  </span>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Puntaje estimado
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl text-[color:var(--ink)]">
                    {hasEvaluation ? evaluation?.score : "--"}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">/ 100</p>
                </div>
              </div>
              <div className="mt-4 h-2 w-full rounded-full bg-[var(--soft)]">
                <div
                  className="h-2 rounded-full bg-[color:var(--accent-2)]"
                  style={{ width: progressWidth }}
                />
              </div>
              {!hasEvaluation && (
                <div className="callout mt-4 rounded-xl border border-dashed p-3 text-xs">
                  Envia respuestas o inicia el tutor para generar un diagnostico
                  real.
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="panel-lite rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Conceptos flojos
                  </p>
                  <ul className="mt-2 text-sm text-[color:var(--ink)]">
                    {(evaluation?.weakConcepts?.length
                      ? evaluation.weakConcepts
                      : ["Sin datos aun"]
                    ).map((concept) => (
                      <li key={concept}>• {concept}</li>
                    ))}
                  </ul>
                </div>
                <div className="panel-lite rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Acciones rapidas
                  </p>
                  <ul className="mt-2 text-sm text-[color:var(--ink)]">
                    {(evaluation?.nextActions?.length
                      ? evaluation.nextActions
                      : ["Sin datos aun"]
                    ).map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {evaluation?.summary && (
                <div className="panel-lite mt-4 rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Resumen
                  </p>
                  <p className="mt-2 text-sm italic text-[color:var(--muted)]">
                    {evaluation.summary}
                  </p>
                </div>
              )}
              {evaluation?.updatedAt && (
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Actualizado {formatTime(evaluation.updatedAt)}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

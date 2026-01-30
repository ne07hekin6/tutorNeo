import OpenAI from "openai";
import { NextResponse } from "next/server";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type TaskConfig = {
  topic?: string;
  objective?: string;
  subject?: string;
  grade?: string;
  durationMin?: string;
};

type StudentProfile = {
  name?: string;
  age?: string;
  course?: string;
  strengths?: string;
  challenges?: string;
};

type ChatRequest = {
  messages?: IncomingMessage[];
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  taskConfig?: TaskConfig;
  student?: StudentProfile;
  start?: boolean;
};

const FORMAT_INSTRUCTIONS =
  "Responde SOLO en JSON valido con este formato: " +
  "{\"reply\":\"...\",\"evaluation\":{\"status\":\"Aprobado\"|\"En proceso\",\"score\":0-100,\"weakConcepts\":[\"...\"],\"nextActions\":[\"...\"],\"summary\":\"...\"}}. " +
  "Reglas para reply: maximo una pregunta (un solo signo ?), si haces una pregunta que sea al final, y no incluyas resumen ni siguientes pasos en reply (eso va en evaluation.summary y nextActions).";

function buildContext(task?: TaskConfig, student?: StudentProfile) {
  const lines = ["Contexto de tarea:"];
  if (task) {
    lines.push(`- Tema: ${task.topic ?? "N/D"}`);
    lines.push(`- Objetivo: ${task.objective ?? "N/D"}`);
    lines.push(`- Materia: ${task.subject ?? "N/D"}`);
    lines.push(`- Grado: ${task.grade ?? "N/D"}`);
    lines.push(`- Duracion estimada: ${task.durationMin ?? "N/D"} min`);
  }
  lines.push("Perfil del alumno:");
  if (student) {
    lines.push(`- Nombre: ${student.name ?? "N/D"}`);
    lines.push(`- Edad: ${student.age ?? "N/D"}`);
    lines.push(`- Curso: ${student.course ?? "N/D"}`);
    lines.push(`- Fortalezas: ${student.strengths ?? "N/D"}`);
    lines.push(`- Dificultades: ${student.challenges ?? "N/D"}`);
  }
  return lines.join("\n");
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function enforceSingleQuestion(reply: string) {
  const first = reply.indexOf("?");
  if (first === -1) return reply.trim();
  const second = reply.indexOf("?", first + 1);
  if (second === -1) return reply.trim();
  return reply.slice(0, first + 1).trim();
}

function normalizeEvaluation(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const evaluation = value as {
    status?: string;
    score?: number;
    weakConcepts?: unknown;
    nextActions?: unknown;
    summary?: string;
  };

  const status = evaluation.status === "Aprobado" ? "Aprobado" : "En proceso";
  const score = Number.isFinite(evaluation.score) ? evaluation.score : 0;
  const weakConcepts = Array.isArray(evaluation.weakConcepts)
    ? evaluation.weakConcepts.filter((item) => typeof item === "string")
    : [];
  const nextActions = Array.isArray(evaluation.nextActions)
    ? evaluation.nextActions.filter((item) => typeof item === "string")
    : [];

  return {
    status,
    score: Math.max(0, Math.min(100, Math.round(score))),
    weakConcepts,
    nextActions,
    summary:
      typeof evaluation.summary === "string" ? evaluation.summary : undefined,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  const apiKey = process.env.OPENAI_API_KEY || body.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 400 },
    );
  }

  const model = body.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const input: IncomingMessage[] = [];
  if (body.systemPrompt?.trim()) {
    input.push({ role: "system", content: body.systemPrompt.trim() });
  }

  input.push({
    role: "system",
    content: buildContext(body.taskConfig, body.student),
  });

  if (body.start) {
    input.push({
      role: "system",
      content: "Inicia la conversacion con la primera pregunta al alumno.",
    });
  }

  input.push({ role: "system", content: FORMAT_INSTRUCTIONS });

  if (Array.isArray(body.messages)) {
    input.push(
      ...body.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    );
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model,
      input,
    });

    const outputText = response.output_text || "";
    const parsed = extractJson(outputText);
    const rawReply =
      parsed && typeof parsed.reply === "string" ? parsed.reply : outputText;
    const reply = enforceSingleQuestion(rawReply);
    const evaluation = normalizeEvaluation(parsed?.evaluation);

    return NextResponse.json({
      text: reply,
      evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OpenAI request failed",
      },
      { status: 500 },
    );
  }
}

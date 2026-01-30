# TutorNeo POC – TODO

> Base: TutorNeo_Tarea_Conversacional_IA.pdf (OCR extract). Objetivo: demo de una tarea conversacional en una sola pantalla, con configuración de tarea, perfil del alumno, chat, diagnóstico y funciones del tutor. Todo en localStorage, sin BD.

## 1) Contenido y narrativa (del PDF)
- Problema: tarea tradicional mide cumplimiento, no comprensión; feedback tardío; carga docente insostenible; copia/ayuda externa.
- Solución: tarea como conversación guiada (docente configura en 30s, alumno conversa en casa, sistema devuelve estado Aprobado/En proceso y refuerzo).
- Experiencia alumno: preguntas abiertas + razonamiento; pide ejemplos; no acepta respuesta memorizada.
- Vista docente: estado por alumno, insights de curso, acciones rápidas.
- Valor institucional: innovación visible, mejora académica, comunicación con familias.
- Eficiencia operativa: creación rápida, fin de corrección repetitiva, foco pedagógico.
- POC: config rápida, chat 8–12 min, motor evaluación, panel liviano, refuerzo automático.
- Roadmap piloto 2 semanas + métricas éxito + visión futura.

## 2) Alcance funcional (POC)
- Una sola pantalla responsive con 3 columnas (config / chat / diagnóstico).
- Configuración de tarea (tema, objetivo, grado, duración estimada, materia).
- Perfil del alumno (nombre, edad, curso, fortalezas, dificultades).
- Editor de system prompt visible y editable.
- Chat alumno-tutor con mensajes, input y “modo demo” (mock) + “modo API”.
- Resultados simulados: estado Aprobado/En proceso, puntaje, conceptos flojos, acciones rápidas.
- Sección “Funciones del tutor” con cards resumiendo capacidades.
- Persistencia con localStorage (config, alumno, prompt, chat, métricas).

## 3) Estructura de datos (front)
- taskConfig: {topic, objective, subject, grade, durationMin}
- studentProfile: {name, age, course, strengths, challenges}
- systemPrompt: string
- messages: [{id, role, content, ts}]
- evaluation: {status, score, weakConcepts, nextActions}
- ui: {useLiveApi:boolean}

## 4) API de OpenAI (preparación)
- Crear route `/app/api/chat/route.ts` con SDK `openai`.
- Usar `OPENAI_API_KEY` desde env y modelo configurable (env con fallback).
- Request: `client.responses.create({ model, input: [...] })` con system + historial.
- Responder con `output_text` y errores claros si falta API key.

## 5) LocalStorage
- Claves sugeridas:
  - `tutorneo.taskConfig`
  - `tutorneo.studentProfile`
  - `tutorneo.systemPrompt`
  - `tutorneo.messages`
  - `tutorneo.evaluation`
  - `tutorneo.ui`
- Cargar en `useEffect` al montar y guardar en `useEffect` al cambiar.

## 6) UI/Estilo
- Tailwind + layout visual fuerte (gradientes + textura ligera, tarjetas con borde/blur).
- Tipografías no-default (display + body).
- Paleta: marino/teal + coral; fondo cálido/crema.
- Animaciones: entrada suave de cards + mensajes.

## 7) Pasos de implementación
- [ ] Actualizar `app/layout.tsx` con nuevas fuentes y metadata.
- [ ] Actualizar `app/globals.css` con variables, fondo y estilos base.
- [ ] Crear `app/api/chat/route.ts` con OpenAI SDK.
- [ ] Crear UI en `app/page.tsx` (client component) + hooks localStorage.
- [ ] Agregar helpers: `useLocalStorage` simple y mock tutor.
- [ ] Ajustar `package.json`/deps (agregar `openai`).
- [ ] Verificar layout responsive.

## 8) QA rápida
- [ ] `npm run lint`
- [ ] `npm run dev` y revisar localStorage/flow.

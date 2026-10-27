# Contexto

App web personal para unir varios PDF en uno solo. Todo el procesado (fusión, miniaturas y vista previa) ocurre en el navegador: los archivos nunca se suben a un servidor ni deben pasar por la red. La UI está en español (`index.html` usa `lang="es"`); mantén los textos visibles en español.

# Stack

Vite 8, React 19, TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), `pdf-lib`, `pdfjs-dist` y dnd-kit. Gestor de paquetes: npm (`package-lock.json`). Sin backend.

# Comandos

- `npm run dev`: servidor de Vite en `http://localhost:5173`.
- `npm run build`: `tsc -b && vite build`. Es la única verificación automatizada; no hay lint, tests ni formatter.
- `npx tsc -b`: solo typecheck (más rápido durante el desarrollo).
- `npm run preview`: sirve el contenido de `dist/`.

`npm run build` avisa de un chunk >500 kB (pdfjs-dist + pdf-lib); es esperado, no un fallo.

# Arquitectura

- `src/App.tsx`: toda la UI y el estado (selección, drag & drop, diálogo de vista previa, iconos SVG inline). No hay router, estado global ni componentes en archivos separados.
- `src/lib/mergePdfs.ts`: fusión con `pdf-lib`. El orden del array de archivos es el orden final de las páginas; la UI lo controla con drag & drop.
- `src/lib/renderPdfThumbnails.ts`: miniaturas y vista previa con `pdfjs-dist`. El import `pdfjs-dist/build/pdf.worker.min.mjs?url` junto con `GlobalWorkerOptions.workerSrc` es necesario para Vite; no lo elimines. Devuelve object URLs: quien llama debe revocarlas y cancelar la tarea con `AbortSignal` (patrón ya usado en `App.tsx`).
- Tailwind 4 se configura solo en CSS: `src/index.css` (`@import "tailwindcss"` y `@theme`). No existe `tailwind.config.js`; no hace falta añadirlo para cambios normales.
- Flujo: seleccionar PDF → reordenar/eliminar → «Unir y previsualizar» → descargar. La vista previa solo existe después de fusionar.

# TypeScript y estilo

- `tsconfig.app.json` usa project references. `tsc -b` falla por `noUnusedLocals`/`noUnusedParameters`: no dejes imports, variables ni parámetros sin usar.
- `verbatimModuleSyntax`: usa `import type` para tipos. `erasableSyntaxOnly`: evita enums, namespaces y propiedades de parámetro.
- Sin Prettier ni ESLint: sigue el estilo del código existente en TS/TSX (comillas simples, sin punto y coma, 2 espacios y comas finales).

# Flujos de trabajo

- Los skills de `.opencode/skills/` (`backlog`, `story`, `pair`) los invoca el usuario; no los ejecutes por iniciativa propia.
- `/pair` exige TDD, pero no hay test runner instalado: pregunta antes de añadir Vitest u otro framework.
- Según `/pair`, el agente nunca hace commits; los hace el usuario.

# Decisiones caras de cambiar

Ninguna: sin multi-tenant, roles ni permisos, offline ni sincronización, multi-idioma ni multi-moneda.

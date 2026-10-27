# Unir PDF

Aplicación web personal para unir varios PDF en uno solo. Todo el procesamiento ocurre en el navegador: los archivos no se suben a ningún servidor.

## Características

- Selección de varios PDF a la vez, con aviso si se elige algún archivo que no es PDF.
- Reordenación de los documentos con arrastrar y soltar.
- Miniaturas de las páginas de cada PDF antes de unirlos.
- Nombre personalizado para el archivo de salida.
- Vista previa del PDF unido antes de descargarlo.
- Descarga directa del resultado.
- Funcionamiento 100 % local y sin backend.

## Stack

| Área | Tecnología |
| --- | --- |
| Interfaz | React 19 + TypeScript |
| Build | Vite 8 |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Unión de PDF | `pdf-lib` |
| Miniaturas y vista previa | `pdfjs-dist` |
| Drag & drop | dnd-kit |

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`
- npm

## Instalación

```bash
npm install
```

## Uso

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

1. Pulsa **Seleccionar PDF** y elige al menos dos documentos.
2. Arrastra los archivos desde el asa para definir el orden de las páginas.
3. Escribe el nombre que tendrá el PDF final.
4. Pulsa **Unir y previsualizar**.
5. Revisa la vista previa y pulsa **Descargar PDF**.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo de Vite. |
| `npm run build` | Comprueba los tipos y genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve localmente la build de `dist/`. |
| `npx tsc -b` | Ejecuta solo la comprobación de tipos. |

No hay lint, tests ni formatter configurados.

> La build muestra un aviso de chunk mayor de 500 kB debido a `pdfjs-dist` y `pdf-lib`. Es esperado y no impide la compilación.

## Estructura del proyecto

```text
src/
├── App.tsx                      # Interfaz, estado y flujo completo
├── main.tsx                     # Punto de entrada de React
├── index.css                    # Tailwind y estilos base
└── lib/
    ├── mergePdfs.ts             # Unión de PDF con pdf-lib
    └── renderPdfThumbnails.ts   # Miniaturas con pdfjs-dist
```

- `src/App.tsx` concentra la interfaz: selección de archivos, drag & drop, diálogo de vista previa e iconos.
- `src/lib/mergePdfs.ts` copia las páginas de cada documento en el orden en que aparecen en la lista.
- `src/lib/renderPdfThumbnails.ts` renderiza las páginas en un canvas y devuelve object URLs. El worker de `pdfjs-dist` se importa con `?url` para que Vite lo incluya en la build.
- Tailwind 4 se configura desde `src/index.css`; no hay `tailwind.config.js`.

## Cómo funciona

1. Los archivos seleccionados se mantienen en memoria, en el estado de React.
2. `pdfjs-dist` renderiza cada página como una miniatura.
3. `pdf-lib` carga los documentos y copia todas sus páginas en un PDF nuevo, respetando el orden de la lista.
4. El resultado se renderiza de nuevo para mostrar la vista previa.
5. La descarga se genera con un `Blob` local mediante un object URL.

## Privacidad

La aplicación no tiene backend ni realiza peticiones de red con los documentos. Los PDF se leen, se unen, se previsualizan y se descargan íntegramente en el navegador.

Los archivos solo permanecen en memoria mientras la página está abierta; al recargar se pierde la selección y el PDF generado.

## Limitaciones

- No se pueden unir PDF dañados o protegidos con contraseña.
- Se necesitan al menos dos PDF para generar la unión.
- Al procesarse en el navegador, los documentos muy grandes consumen memoria del dispositivo.

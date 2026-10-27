import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { mergePdfs } from './lib/mergePdfs'
import {
  renderPdfThumbnails,
  type PdfThumbnail,
} from './lib/renderPdfThumbnails'

type Status = {
  kind: 'success' | 'error'
  message: string
}

type SelectedFile = {
  id: string
  file: File
}

type MergedPdf = {
  bytes: Uint8Array
  fileName: string
}

type IconProps = {
  className?: string
}

const DEFAULT_OUTPUT_NAME = 'documento-unido'
const DEFAULT_FILE_NAME = `${DEFAULT_OUTPUT_NAME}.pdf`

function isPdfFile(file: File) {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

function formatFileCount(count: number) {
  return count === 1 ? '1 PDF seleccionado' : `${count} PDF seleccionados`
}

function getOutputFileName(name: string) {
  const nameWithoutExtension = name.trim().replace(/\.pdf$/i, '').trim()
  const safeName = nameWithoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, '-')
    .replace(/[.\s-]+$/g, '')

  return safeName ? `${safeName}.pdf` : DEFAULT_FILE_NAME
}

function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

type SortableFileRowProps = {
  selectedFile: SelectedFile
  index: number
  isMerging: boolean
  onRemove: (id: string) => void
}

function SortableFileRow({
  selectedFile,
  index,
  isMerging,
  onRemove,
}: SortableFileRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: selectedFile.id, disabled: isMerging })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex flex-col gap-2 px-4 py-3 ${
        isDragging
          ? 'relative z-10 bg-white shadow-md ring-1 ring-indigo-100'
          : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={isMerging}
          aria-label={`Mover ${selectedFile.file.name}`}
          title="Arrastrar para reordenar"
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GripIcon className="size-4" />
        </button>

        <span className="w-5 shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-400">
          {index + 1}
        </span>
        <DocumentIcon className="size-4 shrink-0 text-indigo-500" />
        <span className="min-w-0 flex-1 break-words text-sm leading-5 text-slate-700">
          {selectedFile.file.name}
        </span>
        <button
          type="button"
          onClick={() => onRemove(selectedFile.id)}
          disabled={isMerging}
          aria-label={`Quitar ${selectedFile.file.name}`}
          title="Quitar PDF"
          className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <FileThumbnails file={selectedFile.file} />
    </li>
  )
}

type ThumbnailState = 'loading' | 'ready' | 'error'

function FileThumbnails({ file }: { file: File }) {
  const [thumbnails, setThumbnails] = useState<PdfThumbnail[]>([])
  const [state, setState] = useState<ThumbnailState>('loading')

  useEffect(() => {
    const controller = new AbortController()
    let createdUrls: string[] = []

    setThumbnails([])
    setState('loading')

    renderPdfThumbnails(file, controller.signal)
      .then((result) => {
        createdUrls = result.map(({ url }) => url)

        if (controller.signal.aborted) {
          createdUrls.forEach((url) => URL.revokeObjectURL(url))
          return
        }

        if (result.length === 0) {
          setState('error')
          return
        }

        setThumbnails(result)
        setState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState('error')
        }
      })

    return () => {
      controller.abort()
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [file])

  if (state === 'loading') {
    return (
      <div>
        <div className="flex gap-2" aria-hidden="true">
          <span className="h-20 w-14 animate-pulse rounded-md bg-slate-200/80" />
          <span className="h-20 w-20 animate-pulse rounded-md bg-slate-200/80" />
          <span className="h-20 w-14 animate-pulse rounded-md bg-slate-200/80" />
        </div>
        <span className="sr-only">Cargando páginas de {file.name}…</span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-xs leading-5 text-amber-700">
        <AlertIcon className="size-3.5 shrink-0" />
        No se pudieron mostrar las páginas.
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label={`Páginas de ${file.name}`}
      tabIndex={0}
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {thumbnails.map((thumbnail) => (
        <figure
          key={thumbnail.pageNumber}
          className="relative shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
        >
          <img
            src={thumbnail.url}
            alt={`Página ${thumbnail.pageNumber} de ${file.name}`}
            width={thumbnail.width}
            height={thumbnail.height}
            className="block h-20 w-auto"
          />
          <figcaption className="absolute right-1 bottom-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums text-white">
            {thumbnail.pageNumber}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

type MergedPreviewDialogProps = {
  mergedPdf: MergedPdf
  onClose: () => void
  onDownload: () => void
}

function MergedPreviewDialog({
  mergedPdf,
  onClose,
  onDownload,
}: MergedPreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pages, setPages] = useState<PdfThumbnail[]>([])
  const [state, setState] = useState<ThumbnailState>('loading')

  useEffect(() => {
    const dialog = dialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const pdfBlob = new Blob([new Uint8Array(mergedPdf.bytes)], {
      type: 'application/pdf',
    })
    let createdUrls: string[] = []

    setPages([])
    setState('loading')

    renderPdfThumbnails(pdfBlob, controller.signal, {
      pixelHeight: 720,
      maxPixelWidth: 1_100,
    })
      .then((result) => {
        createdUrls = result.map(({ url }) => url)

        if (controller.signal.aborted) {
          createdUrls.forEach((url) => URL.revokeObjectURL(url))
          return
        }

        if (result.length === 0) {
          setState('error')
          return
        }

        setPages(result)
        setState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState('error')
        }
      })

    return () => {
      controller.abort()
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [mergedPdf])

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleDownload() {
    onDownload()
    closeDialog()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="preview-title"
      aria-describedby="preview-file-name"
      className="m-auto max-h-[92svh] w-11/12 max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-0 text-left shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-indigo-600 uppercase">
            PDF unido
          </p>
          <h2
            id="preview-title"
            className="mt-1 text-lg font-semibold tracking-tight text-slate-900"
          >
            Vista previa
          </h2>
          <p
            id="preview-file-name"
            className="mt-0.5 truncate text-xs text-slate-500"
            title={mergedPdf.fileName}
          >
            {mergedPdf.fileName}
          </p>
        </div>

        <button
          type="button"
          onClick={closeDialog}
          aria-label="Cerrar vista previa"
          title="Cerrar"
          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="max-h-[55svh] overflow-y-auto overscroll-contain bg-slate-50/80 px-4 py-5 sm:px-6">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <span className="h-[45svh] w-2/3 max-w-xs animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
            <p className="text-sm text-slate-500">Generando vista previa…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertIcon className="size-6" />
            </span>
            <p className="text-sm font-medium text-slate-700">
              No se pudo mostrar la vista previa.
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Puedes descargar el PDF unido igualmente.
            </p>
          </div>
        )}

        {state === 'ready' && (
          <div className="space-y-5">
            {pages.map((page) => (
              <figure
                key={page.pageNumber}
                className="flex flex-col items-center"
              >
                <img
                  src={page.url}
                  alt={`Página ${page.pageNumber} de ${mergedPdf.fileName}`}
                  width={page.width}
                  height={page.height}
                  loading="lazy"
                  decoding="async"
                  className="block max-h-[55svh] w-auto max-w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                />
                <figcaption className="mt-2 text-xs font-medium tabular-nums text-slate-500">
                  Página {page.pageNumber}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <button
          type="button"
          onClick={closeDialog}
          className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          Volver a la selección
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={state === 'loading'}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <DownloadIcon className="size-4" />
          Descargar PDF
        </button>
      </div>
    </dialog>
  )
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextFileId = useRef(0)
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [outputName, setOutputName] = useState(DEFAULT_OUTPUT_NAME)
  const [mergedPdf, setMergedPdf] = useState<MergedPdf | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const canMerge = files.length >= 2 && !isMerging

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (selectedFiles.length === 0) return

    const pdfFiles = selectedFiles.filter(isPdfFile)
    const skippedCount = selectedFiles.length - pdfFiles.length

    if (pdfFiles.length > 0) {
      const newFiles = pdfFiles.map((file) => ({
        id: `pdf-${nextFileId.current++}`,
        file,
      }))

      setFiles((currentFiles) => [...currentFiles, ...newFiles])
    }

    if (skippedCount > 0) {
      setStatus({
        kind: 'error',
        message:
          skippedCount === 1
            ? 'Uno de los archivos no es un PDF y no se añadió.'
            : `${skippedCount} archivos no son PDF y no se añadieron.`,
      })
      return
    }

    setStatus(null)
  }

  function removeFile(idToRemove: string) {
    if (isMerging) return

    setFiles((currentFiles) =>
      currentFiles.filter(({ id }) => id !== idToRemove),
    )
    setStatus(null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || isMerging) return

    setFiles((currentFiles) => {
      const oldIndex = currentFiles.findIndex(({ id }) => id === active.id)
      const newIndex = currentFiles.findIndex(({ id }) => id === over.id)

      if (oldIndex === -1 || newIndex === -1) return currentFiles

      return arrayMove(currentFiles, oldIndex, newIndex)
    })
    setStatus(null)
  }

  async function handleMerge() {
    if (!canMerge) return

    setIsMerging(true)
    setStatus(null)

    try {
      const mergedBytes = await mergePdfs(files.map(({ file }) => file))
      setMergedPdf({
        bytes: mergedBytes,
        fileName: getOutputFileName(outputName),
      })
    } catch (error) {
      console.error(error)
      setStatus({
        kind: 'error',
        message:
          'No se pudieron unir los PDF. Comprueba que no estén dañados ni protegidos con contraseña.',
      })
    } finally {
      setIsMerging(false)
    }
  }

  function handleDownload() {
    if (!mergedPdf) return

    downloadPdf(mergedPdf.bytes, mergedPdf.fileName)
    setStatus({
      kind: 'success',
      message: 'PDF unido y descargado. Ya puedes abrirlo en tu equipo.',
    })
  }

  function closePreview() {
    setMergedPdf(null)
  }

  return (
    <div className="relative isolate min-h-svh overflow-hidden bg-slate-50 text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-48 -right-40 size-[30rem] rounded-full bg-indigo-200/60 blur-3xl" />
        <div className="absolute -bottom-56 -left-40 size-[28rem] rounded-full bg-sky-200/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-5xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
              <DocumentIcon className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-800">
              Unir PDF
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <LockIcon className="size-3.5 text-emerald-600" />
            100 % local
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-6 sm:py-10">
          <section
            aria-busy={isMerging}
            className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-10"
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-7">
                <div className="absolute inset-0 -rotate-6 rounded-3xl bg-indigo-200/70" />
                <div className="absolute inset-0 rotate-6 rounded-3xl bg-sky-200/70" />
                <div className="relative grid size-16 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-600/25">
                  <DocumentIcon className="size-8" />
                </div>
              </div>

              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Une tus PDF en uno solo
              </h1>
              <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-500 sm:text-base">
                Selecciona varios documentos y descárgalos como un único archivo.
                Todo ocurre en tu navegador; nada se sube a un servidor.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                aria-label="Seleccionar archivos PDF"
                className="hidden"
                onChange={handleFileSelection}
              />

              {files.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50/80 via-white/70 to-sky-50/70">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatFileCount(files.length)}
                    </p>

                    {files.length >= 2 && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircleIcon className="size-3.5" />
                        Listos para unir
                      </span>
                    )}
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={files.map(({ id }) => id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul
                        aria-label="Lista de PDF seleccionados"
                        className="max-h-[30rem] divide-y divide-indigo-100/70 overflow-y-auto overscroll-contain border-t border-indigo-100/70 bg-white/60"
                      >
                        {files.map((selectedFile, index) => (
                          <SortableFileRow
                            key={selectedFile.id}
                            selectedFile={selectedFile}
                            index={index}
                            isMerging={isMerging}
                            onRemove={removeFile}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="output-file-name"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Nombre del PDF
                  </label>
                  <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                    <input
                      id="output-file-name"
                      type="text"
                      value={outputName}
                      onChange={(event) => setOutputName(event.target.value)}
                      onBlur={() =>
                        setOutputName((currentName) =>
                          currentName
                            .trim()
                            .replace(/\.pdf$/i, '')
                            .trim(),
                        )
                      }
                      disabled={isMerging}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={DEFAULT_OUTPUT_NAME}
                      className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span className="flex items-center border-l border-slate-100 bg-slate-50 px-3 text-sm font-medium text-slate-500">
                      .pdf
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isMerging}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusIcon className="size-4" />
                  {files.length > 0 ? 'Añadir más PDF' : 'Seleccionar PDF'}
                </button>

                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={!canMerge}
                  aria-describedby="merge-hint"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {isMerging ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                  {isMerging ? 'Uniendo…' : 'Unir y previsualizar'}
                </button>
              </div>

              <p
                id="merge-hint"
                className="text-center text-xs leading-5 text-slate-400"
              >
                {files.length < 2
                  ? 'Selecciona al menos 2 PDF para unir.'
                  : 'Se unirán en el orden de la lista. Arrastra desde los puntos para cambiarlo.'}
              </p>

              {status && (
                <div
                  role={status.kind === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm ${
                    status.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {status.kind === 'success' ? (
                    <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertIcon className="mt-0.5 size-4 shrink-0" />
                  )}
                  <p>{status.message}</p>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="pt-2 pb-6 text-center text-xs leading-5 text-slate-400">
          Tus archivos se procesan en este dispositivo y nunca se envían a
          internet.
        </footer>
      </div>

      {mergedPdf && (
        <MergedPreviewDialog
          mergedPdf={mergedPdf}
          onClose={closePreview}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}

function DocumentIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 3.75h6.25L19 8.5v9.75a2.25 2.25 0 0 1-2.25 2.25H8a2.25 2.25 0 0 1-2.25-2.25V6A2.25 2.25 0 0 1 8 3.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.9v4.6h4.85M9.5 12.5h5M9.5 16h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EyeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.75 12S6 6.25 12 6.25 21.25 12 21.25 12 18 17.75 12 17.75 2.75 12 2.75 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6.5 6.5 11 11m0-11-11 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LockIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m8.5 12.3 2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GripIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M7 7l.7 11.3a2 2 0 0 0 2 1.7h4.6a2 2 0 0 0 2-1.7L17 7M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlertIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 7.5v5.5M12 16.5h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SpinnerIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default App

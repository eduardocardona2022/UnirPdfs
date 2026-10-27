import {
  GlobalWorkerOptions,
  getDocument,
  type RenderTask,
} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export type PdfThumbnail = {
  pageNumber: number
  url: string
  width: number
  height: number
}

const THUMBNAIL_PIXEL_HEIGHT = 160
const MAX_THUMBNAIL_WIDTH = 400

type RenderPdfThumbnailsOptions = {
  pixelHeight?: number
  maxPixelWidth?: number
}

export async function renderPdfThumbnails(
  file: Blob,
  signal: AbortSignal,
  {
    pixelHeight = THUMBNAIL_PIXEL_HEIGHT,
    maxPixelWidth = MAX_THUMBNAIL_WIDTH,
  }: RenderPdfThumbnailsOptions = {},
): Promise<PdfThumbnail[]> {
  signal.throwIfAborted()

  const data = await file.arrayBuffer()
  signal.throwIfAborted()

  const loadingTask = getDocument({ data })
  const thumbnails: PdfThumbnail[] = []
  let renderTask: RenderTask | null = null

  function cancelRendering() {
    renderTask?.cancel()
    void loadingTask.destroy().catch(() => {})
  }

  signal.addEventListener('abort', cancelRendering, { once: true })

  try {
    const pdf = await loadingTask.promise
    signal.throwIfAborted()

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      signal.throwIfAborted()

      const page = await pdf.getPage(pageNumber)
      const originalViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(
        pixelHeight / originalViewport.height,
        maxPixelWidth / originalViewport.width,
      )
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')

      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))

      renderTask = page.render({
        canvas,
        viewport,
        background: '#ffffff',
      })
      await renderTask.promise
      renderTask = null
      signal.throwIfAborted()

      const blob = await canvasToBlob(canvas)
      signal.throwIfAborted()

      thumbnails.push({
        pageNumber,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      })

      page.cleanup()
    }

    return thumbnails
  } catch (error) {
    for (const { url } of thumbnails) {
      URL.revokeObjectURL(url)
    }

    throw error
  } finally {
    signal.removeEventListener('abort', cancelRendering)

    try {
      await loadingTask.destroy()
    } catch {
      // The loading task may already be destroyed after an abort.
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('No se pudo crear la miniatura.'))
        }
      },
      'image/jpeg',
      0.82,
    )
  })
}

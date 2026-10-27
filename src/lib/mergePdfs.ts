import { PDFDocument } from 'pdf-lib'

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const mergedDocument = await PDFDocument.create()

  for (const file of files) {
    const sourceDocument = await PDFDocument.load(await file.arrayBuffer())
    const pages = await mergedDocument.copyPages(
      sourceDocument,
      sourceDocument.getPageIndices(),
    )

    for (const page of pages) {
      mergedDocument.addPage(page)
    }
  }

  return mergedDocument.save()
}

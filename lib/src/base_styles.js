let documentStyleSheet = null

const DOCUMENT_STYLES = `
  @layer imp {
    body {
      margin: 0;
    }
  }
`

export const adoptDocumentStyles = () => {
  if (documentStyleSheet) return
  documentStyleSheet = new CSSStyleSheet()
  documentStyleSheet.replaceSync(DOCUMENT_STYLES)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, documentStyleSheet]
}

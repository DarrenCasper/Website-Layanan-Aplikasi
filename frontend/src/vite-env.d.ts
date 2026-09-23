/// <reference types="vite/client" />

// Declared so the API base URL is a checked string rather than the `any` that
// vite/client's index signature would otherwise hand back.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

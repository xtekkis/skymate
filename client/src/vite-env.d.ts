/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the API lives, when it is not on this origin.
   *
   * Set only where the client is built. Unset, requests go to /api on the
   * same origin, which is right in development and wherever the two halves
   * are served together.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

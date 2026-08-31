import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bundled rather than fetched from Google. Ahead of index.css so the faces are
// declared before anything asks for them.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

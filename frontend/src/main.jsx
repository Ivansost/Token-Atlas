import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import { applyTokens } from './design/tokens.js'
import './index.css'

// Publish the design tokens as CSS custom properties before the first paint, so the chrome and
// the WebGL scene are reading the same values from the same place.
applyTokens()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

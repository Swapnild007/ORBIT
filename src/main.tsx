import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const apiBase = (import.meta.env.VITE_ORBIT_API_URL || '').replace(/\/$/, '')
if (apiBase) {
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    if (url.startsWith('/api/')) return nativeFetch(apiBase + url, init)
    return nativeFetch(input, init)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

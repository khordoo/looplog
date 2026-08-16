import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><main><h1>Training Tracker</h1><p>Loading your private training space…</p></main></StrictMode>,
)

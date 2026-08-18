import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { applyAppearance, readAppearancePreference } from './lib/theme'

const root = document.getElementById('root')
if (!root) throw new Error('Missing root element')
applyAppearance(readAppearancePreference())
createRoot(root).render(<StrictMode><App /></StrictMode>)
registerServiceWorker()

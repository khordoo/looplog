import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './providers/AppProvider'
import { AppRoutes } from './routes'
import type { StorageAdapter } from '../storage/adapter'

export function App({ adapter }: { adapter?: StorageAdapter }) {
  return <BrowserRouter><AppProvider adapter={adapter}><AppRoutes /></AppProvider></BrowserRouter>
}

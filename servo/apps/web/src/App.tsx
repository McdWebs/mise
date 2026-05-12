import { Routes, Route } from 'react-router-dom'
import TokensPage from './pages/dev/TokensPage'

export default function App() {
  return (
    <Routes>
      {/* Dev QA routes */}
      <Route path="/dev/tokens" element={<TokensPage />} />

      {/* Placeholder index */}
      <Route
        path="/"
        element={
          <div className="flex min-h-screen items-center justify-center bg-paper">
            <p className="font-display text-h1 text-ink">Servo</p>
          </div>
        }
      />
    </Routes>
  )
}

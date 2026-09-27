import { useEffect } from 'react'
import { CookieBanner } from './components/CookieBanner'
import { Footer } from './components/Footer'
import { Nav } from './components/Nav'
import { useRoute } from './lib/useRoute'
import { scrollPageTop } from './lib/router'
import { Home } from './pages/Home'
import { Join } from './pages/Join'
import { Legal } from './pages/Legal'

const LEGAL = new Set(['impressum', 'datenschutz', 'agb', 'widerruf', 'hausordnung', 'vertrag12', 'vertrag24'])

export default function App() {
  const route = useRoute()

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    if (route.hash) return
    scrollPageTop()
    const frame = window.requestAnimationFrame(() => scrollPageTop())
    return () => window.cancelAnimationFrame(frame)
  }, [route.hash, route.name, route.path])

  return (
    <div className={`shell route-${route.name}`}>
      <Nav route={route} />
      {route.name === 'home' ? <Home /> : null}
      {route.name === 'join' ? <Join plan={route.plan} /> : null}
      {LEGAL.has(route.name) ? (
        <Legal
          name={route.name as 'impressum' | 'datenschutz' | 'agb' | 'widerruf' | 'hausordnung' | 'vertrag12' | 'vertrag24'}
        />
      ) : null}
      {route.name === 'notfound' ? (
        <main className="page">
          <h1>Seite nicht da.</h1>
          <p>Zurück auf die Startseite und neu zielen.</p>
        </main>
      ) : null}
      <Footer />
      <CookieBanner />
    </div>
  )
}

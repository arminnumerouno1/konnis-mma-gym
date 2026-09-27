import { Footer } from './components/Footer'
import { Nav } from './components/Nav'
import { useRoute } from './lib/useRoute'
import { Home } from './pages/Home'
import { Join } from './pages/Join'
import { Legal } from './pages/Legal'

const LEGAL = new Set(['impressum', 'datenschutz', 'agb', 'widerruf', 'hausordnung', 'vertrag12', 'vertrag24'])

export default function App() {
  const route = useRoute()

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
    </div>
  )
}

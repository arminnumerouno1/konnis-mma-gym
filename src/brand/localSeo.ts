import { COPY } from './copy'
import { GYM } from './gym'
import { KONRAD } from './konrad'
import { GOOGLE_REVIEWS } from './reviews'

export type LocalHubId = 'mmaLeipzig' | 'kampfsportLeipzig'

export type LocalFaq = { q: string; a: string }

export type LocalHub = {
  id: LocalHubId
  path: string
  title: string
  description: string
  /** SEO H1 — Keyword drin, Ton wie Startseite. */
  h1: string
  /** Kleine Zeile über dem H1, kein Scramble-Kicker-Klischee. */
  stamp: string
  hit: string
  lead: string[]
  heroImage: string
  heroAlt: string
  storyTitle: string
  story: string[]
  beats: { title: string; text: string }[]
  scheduleNote: string
  schedule: string[]
  placeTitle: string
  place: string[]
  /** Stadtteile/Umland als Fließtext-Namen (SEO), ohne km-Tabelle. */
  placeNames: string
  voiceTitle: string
  faqs: LocalFaq[]
  closeTitle: string
  close: string
  related: { id: LocalHubId; label: string }[]
}

export const LOCAL_HUBS: Record<LocalHubId, LocalHub> = {
  mmaLeipzig: {
    id: 'mmaLeipzig',
    path: '/mma-leipzig',
    title: 'MMA Leipzig · Cage-Training mit Konrad Dyrschka | KONNI',
    description: `MMA Leipzig im KONNI MMA GYM: Cage, Matte und Coaching von ${KONRAD.fullName} (OKTAGON ${KONRAD.oktagonRecord}). ${GYM.street}. Mitglied werden.`,
    stamp: 'KONNI MMA GYM · Wittenberger Straße',
    h1: 'MMA Leipzig',
    hit: 'Vom Käfig auf die Matte.',
    lead: [
      `Wenn du in Leipzig MMA suchst, landest du oft bei Listen und Versprechen. Hier ist der Unterschied konkret: ein Cage in der Halle, ein Head Coach, der selbst noch kämpft – und ein Plan, der Einsteiger und Leute mit Ring-Erfahrung zusammenbringt.`,
      `${KONRAD.fullName} bringt ${KONRAD.record} und OKTAGON ${KONRAD.oktagonRecord} mit auf die Matte. Nicht als Poster an der Wand. Als jemand, der die Stunde mitgestaltet.`,
    ],
    heroImage: GYM.hall.cage,
    heroAlt: `Cage im KONNI MMA GYM, ${GYM.street} Leipzig`,
    storyTitle: 'So fühlt sich MMA hier an',
    story: [
      'Du kommst rein, ziehst die Latschen an, und die Matte ist schon warm. Manche starten mit MMA Basic, andere steigen direkt in die Abend-Einheit. Niemand muss „kämpferisch“ wirken, um willkommen zu sein.',
      'Im Training mischst du Stand und Boden: Schläge, Tritte, Takedowns, Clinch, Kontrolle. Der Cage ist kein Deko-Stück – wenn Clinch am Gitter drankommt, stehst du dort, wo Konrad auch steht.',
      'Samstags Sparring für alle, die den Druck wollen. Unter der Woche Technik und Tempo. Du entscheidest, wie weit du gehst.',
    ],
    beats: [
      {
        title: 'Ohne Kampfambitionen',
        text: 'Technik, Kondition, Kopf frei. Viele bleiben genau dort – und trainieren trotzdem ernst.',
      },
      {
        title: 'Mit Cage vor Augen',
        text: 'Wer kämpfen will, hat einen Coach mit OKTAGON, KSW und EMC im Lebenslauf. Kein Theoriewissen aus YouTube.',
      },
      {
        title: 'Mitbringen',
        text: 'Shirt, kurze Hose, Handtuch, Latschen. Handschuhe und Schoner, sobald du sie brauchst – vorher reicht nachfragen.',
      },
    ],
    scheduleNote: 'MMA im Wochenplan – Auszug',
    schedule: [
      'Mo 10:00 · BJJ NoGi / MMA',
      'Mo 19:30 · MMA Basic',
      'Di 19:30 · MMA',
      'Fr 17:00 · MMA',
      'Sa 10:00 · Sparring',
    ],
    placeTitle: 'Nord-Leipzig, kurze Wege',
    place: [
      `Die Halle steht an der ${GYM.street} in ${GYM.zip} – Leipziger Norden, Richtung Schönefeld. Kein West-Industriehof, kein Umzug „bald irgendwann“: Training läuft hier.`,
      `Konrad kommt aus ${KONRAD.birthPlace}. Darum kennen wir die Wege aus dem Umland – und freuen uns, wenn die Matte voller wird.`,
    ],
    placeNames: `Schönefeld, Eutritzsch, Gohlis, Mockau, Volkmarsdorf, Zentrum, Reudnitz, und aus dem Umland ${KONRAD.birthPlace}, Taucha, Borsdorf, Markkleeberg`,
    voiceTitle: 'Was Leute sagen',
    faqs: [
      {
        q: 'Wo trainiert man MMA in Leipzig bei KONNI?',
        a: `Wittenberger Straße 15, 04129 Leipzig. Cage in der Halle, Kursplan auf der Startseite, Vertrag online unter Mitglied werden. Head Coach: ${KONRAD.fullName}.`,
      },
      {
        q: 'Kann ich als Anfänger mit MMA anfangen?',
        a: 'Ja. MMA Basic und All-Levels-Einheiten sind dafür da. Sag vorher Bescheid – dann wissen wir, worauf wir achten.',
      },
      {
        q: 'Trainiert Konrad wirklich mit?',
        a: `${KONRAD.fullName} ist Mitgründer und Head Coach, Rekord ${KONRAD.record}, OKTAGON ${KONRAD.oktagonRecord}. Er steht im Gym – nicht nur im Impressum.`,
      },
      {
        q: 'Brauche ich schon MMA-Erfahrung?',
        a: 'Nein. Boxen, Ringen oder BJJ helfen, sind aber kein Muss. Regelmäßig kommen zählt mehr als die Vorgeschichte.',
      },
    ],
    closeTitle: 'Platz auf der Matte',
    close: 'Bereit? Dann sichere dir deinen Platz – Slow Start, Standard, Flex oder Plus. Training läuft.',
    related: [{ id: 'kampfsportLeipzig', label: 'Kampfsport in Leipzig' }],
  },
  kampfsportLeipzig: {
    id: 'kampfsportLeipzig',
    path: '/kampfsport-leipzig',
    title: 'Kampfsport Leipzig · MMA, BJJ, Boxen & K1 | KONNI MMA GYM',
    description: `Kampfsport Leipzig: MMA, Ringen, BJJ, Boxen und Kick- & Thai-Boxen im KONNI MMA GYM mit ${KONRAD.fullName}. ${GYM.street}. Jetzt Mitglied werden.`,
    stamp: 'Ein Gym · fünf Disziplinen',
    h1: 'Kampfsport Leipzig',
    hit: 'Nicht nur eine Sportart. Ein Ort.',
    lead: [
      `Kampfsport in Leipzig heißt bei uns: du brauchst dich nicht zwischen Matte und Pratzen zu entscheiden. MMA, Ringen, BJJ No-Gi, Boxen und Kick- & Thai-Boxen laufen unter einem Dach – mit einem Team, das aus dem Cage kommt.`,
      `Google sieht ${GOOGLE_REVIEWS.ratingLabel} bei ${GOOGLE_REVIEWS.countLabel}. Wir sehen lieber, wer Dienstag abends wiederkommt.`,
    ],
    heroImage: GYM.hall.floor,
    heroAlt: `Trainingsfläche KONNI MMA GYM Leipzig`,
    storyTitle: 'Was hier zusammenkommt',
    story: [
      'Manche starten mit Boxen, weil die Hände klar sind. Andere wollen zuerst Boden. Wieder andere wollen MMA von Tag eins. Bei KONNI musst du dich nicht festnageln – die Mitgliedschaft trägt den Wechsel mit.',
      `${KONRAD.fullName} und Mehmet-Deniz Celik haben das Studio gebaut, weil Leipzig ein Gym verdient, in dem Profi-Anspruch und Alltagstraining dieselbe Tür nutzen.`,
      'Anfänger, Studierende, Leute nach der Schicht, Fortgeschrittene: Die Matte ist für alle. Unter 18 mit Elternvollmacht.',
    ],
    beats: COPY.disciplines.map((d) => ({
      title: `${d.name} ${COPY.disciplinePlace}`,
      text: `${d.tagline} ${d.text}`,
    })),
    scheduleNote: 'Die Woche in Stichworten',
    schedule: [
      'MMA · MMA Basic · Sparring',
      'BJJ No-Gi an mehreren Abenden',
      'Boxen Basic & Fortgeschrittene',
      'Ringen',
      'K1 / Kick- & Thai-Boxen',
    ],
    placeTitle: 'Hier trainierst du',
    place: [
      `${GYM.street}, ${GYM.zip} ${GYM.city}. Norden der Stadt, Cage und Matte, Kursplan von Montag bis Samstag.`,
      'Wenn du aus dem Westen oder Süden kommst: Die Fahrt lohnt sich, sobald du einmal die Halle von innen gesehen hast. Wenn du aus dem Norden kommst: Du bist fast schon da.',
    ],
    placeNames: `Gohlis, Eutritzsch, Schönefeld-Abtnaundorf, Mockau, Zentrum, Plagwitz, Lindenau, Connewitz, ${KONRAD.birthPlace}, Taucha, Markkleeberg`,
    voiceTitle: 'Stimmen aus dem Gym',
    faqs: [
      {
        q: 'Welche Kampfsportarten gibt es bei KONNI in Leipzig?',
        a: 'MMA, Ringen, BJJ No-Gi, Boxen und Kick- & Thai-Boxen / K1. Details stehen im Kursplan auf der Startseite.',
      },
      {
        q: 'Was kostet die Mitgliedschaft?',
        a: 'Slow Start 79,99€ (2×/Woche), Standard 99,99€, Flex 109,99€, Plus 119€. Anmeldegebühr 19,99€. Karte, Apple Pay oder SEPA über Stripe.',
      },
      {
        q: 'Für wen ist das Gym gedacht?',
        a: 'Für Einsteiger ohne Vorerfahrung und für Leute, die schon kämpfen. Atmosphäre ohne Ego-Theater – Anspruch trotzdem.',
      },
      {
        q: 'Wie starte ich?',
        a: 'Online Mitglied werden oder Probetraining anfragen. Adresse: Wittenberger Straße 15. Fragen per Mail oder Telefon.',
      },
    ],
    closeTitle: 'Dann komm.',
    close: 'Suchst du Kampfsport in Leipzig, der nach Gym riecht und nicht nach Franchise? Hier ist die Tür.',
    related: [{ id: 'mmaLeipzig', label: 'MMA Leipzig' }],
  },
}

export const LOCAL_HUB_FOOTER = [
  { id: 'mmaLeipzig' as const, label: 'MMA Leipzig' },
  { id: 'kampfsportLeipzig' as const, label: 'Kampfsport Leipzig' },
]

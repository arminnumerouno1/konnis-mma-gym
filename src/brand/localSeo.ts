import { COPY } from './copy'
import { GYM } from './gym'
import { KONRAD } from './konrad'
import { GOOGLE_REVIEWS } from './reviews'

const GYM_ADDRESS_LINE = `${GYM.street}, ${GYM.zip} ${GYM.city}`

export type LocalHubId = 'mmaLeipzig' | 'kampfsportLeipzig'

export type LocalFaq = { q: string; a: string }

export type LocalHub = {
  id: LocalHubId
  path: string
  title: string
  description: string
  h1: string
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
  placeNames: string
  voiceTitle: string
  faqs: LocalFaq[]
  closeTitle: string
  close: string
  related: { id: LocalHubId; label: string }[]
  /** Extra copy only rendered on the MMA hub. */
  coachTitle?: string
  coachParas?: string[]
  weekAsideStamp: string
  weekAsideTitle: string
  weekAsideParas: string[]
}

export const LOCAL_HUBS: Record<LocalHubId, LocalHub> = {
  mmaLeipzig: {
    id: 'mmaLeipzig',
    path: '/mma-leipzig',
    title: 'MMA Leipzig · Training mit Konrad Dyrschka | KONNI MMA GYM',
    description: `MMA in Leipzig im KONNI MMA GYM: Cage, Kursplan und Training mit ${KONRAD.fullName}. ${GYM.street}, ${GYM.zip}. Jetzt Mitglied werden.`,
    stamp: 'KONNI MMA GYM',
    h1: 'MMA in Leipzig',
    hit: 'Vom Käfig auf die Matte.',
    lead: [
      `Im KONNI MMA GYM an der ${GYM.street} trainierst du MMA mit Cage in der Halle. Head Coach ist ${KONRAD.fullName} – aktiver MMA-Profi und Mitgründer.`,
      `Es gibt MMA Basic, MMA und Sparring. Einsteiger und Fortgeschrittene trainieren hier. Vorerfahrung brauchst du nicht.`,
    ],
    heroImage: GYM.hall.cage,
    heroAlt: `Cage im KONNI MMA GYM, ${GYM.street} Leipzig`,
    storyTitle: 'Was du trainierst',
    story: [
      'Stand und Boden in einer Einheit: Schläge, Tritte, Takedowns, Clinch und Kontrolle am Boden.',
      'Der Cage steht in der Halle. Clinch am Gitter und Cage-Arbeit gehören dazu, wenn es im Plan steht.',
      'Du musst nicht kämpfen wollen. Viele kommen für Technik und Fitness. Wer kämpfen will, trainiert mit einem Coach, der selbst im Cage steht.',
    ],
    beats: [
      {
        title: 'Einsteiger',
        text: 'MMA Basic und All Levels. Sag vorher Bescheid, dann passen wir die Stunde an.',
      },
      {
        title: 'Mit Erfahrung',
        text: 'Abend-MMA und Sparring am Samstag. Tempo und Druck, wenn du sie suchst.',
      },
      {
        title: 'Mitbringen',
        text: 'T-Shirt, kurze Hose, Handtuch, Latschen. Handschuhe und Schoner, wenn du welche hast.',
      },
    ],
    scheduleNote: 'MMA im Kursplan',
    schedule: [
      'Montag 10:00 – 11:30 · BJJ NoGi / MMA',
      'Montag 19:30 – 21:00 · MMA Basic',
      'Dienstag 19:30 – 21:00 · MMA',
      'Freitag 17:00 – 18:00 · MMA',
      'Samstag 10:00 – 11:30 · Sparring',
    ],
    placeTitle: 'Adresse',
    place: [
      `${GYM.street}, ${GYM.zip} ${GYM.city}. Im Norden, Richtung Schönefeld.`,
      `Konrad kommt aus ${KONRAD.birthPlace}. Aus dem Umland und aus Stadtteilen wie Gohlis, Eutritzsch oder dem Zentrum ist es nicht weit.`,
    ],
    placeNames: `Schönefeld, Eutritzsch, Gohlis, Mockau, Volkmarsdorf, Zentrum, Reudnitz, ${KONRAD.birthPlace}, Taucha, Borsdorf, Markkleeberg`,
    voiceTitle: 'Was Mitglieder sagen',
    faqs: [
      {
        q: 'Wo kann ich in Leipzig MMA trainieren?',
        a: `Im KONNI MMA GYM, ${GYM.street}, ${GYM.zip} ${GYM.city}. Cage in der Halle. Kursplan auf der Startseite. Mitgliedschaft online unter Mitglied werden.`,
      },
      {
        q: 'Ist MMA für Anfänger geeignet?',
        a: 'Ja. Sag uns vorher Bescheid, dann passen wir die Einheit an. Du brauchst keine Vorerfahrung.',
      },
      {
        q: 'Wer ist der Head Coach?',
        a: `${KONRAD.fullName}, MMA-Profi, Rekord ${KONRAD.record}, OKTAGON ${KONRAD.oktagonRecord}. Mitgründer des Gyms. Dazu Mehmet-Deniz Celik.`,
      },
      {
        q: 'Gibt es einen Cage?',
        a: 'Ja. Im KONNI MMA GYM steht ein MMA-Cage.',
      },
    ],
    closeTitle: 'Mitglied werden',
    close: 'Bereit? Dann sichere dir deinen Platz. Training läuft.',
    related: [{ id: 'kampfsportLeipzig', label: 'Kampfsport in Leipzig' }],
    coachTitle: `${KONRAD.fullName}`,
    coachParas: [
      `Geboren in ${KONRAD.birthPlace}. Pro seit 2013. Rekord ${KONRAD.record}${KONRAD.recordNote ? ` (${KONRAD.recordNote})` : ''}. ${KONRAD.koTkoWins} KO/TKO, ${KONRAD.currentStreak} Siege in Folge. Bei OKTAGON ${KONRAD.oktagonRecord}.`,
      'Er ist Mitgründer und Head Coach. Seine Erfahrung aus dem Käfig kommt direkt ins Training – in MMA, Ringen und dem Alltag auf der Matte.',
    ],
    weekAsideStamp: 'Halle',
    weekAsideTitle: 'Cage, Matte, Säcke',
    weekAsideParas: [`${GYM_ADDRESS_LINE}. Der Käfig steht in der Halle.`],
  },
  kampfsportLeipzig: {
    id: 'kampfsportLeipzig',
    path: '/kampfsport-leipzig',
    title: 'Kampfsport in Leipzig · MMA, BJJ, Boxen & K1 | KONNI',
    description: `Kampfsport in Leipzig: MMA, Ringen, BJJ, Boxen und Kick- & Thai-Boxen im KONNI MMA GYM. Mit ${KONRAD.fullName}. ${GYM.street}. Jetzt Mitglied werden.`,
    stamp: 'KONNI MMA GYM',
    h1: 'Kampfsport in Leipzig',
    hit: 'MMA, Ringen, BJJ, Boxen, K1.',
    lead: [
      `Im KONNI MMA GYM trainierst du MMA, Ringen, BJJ No-Gi, Boxen und Kick- & Thai-Boxen. Ein Gym, ein Kursplan, ${GYM.street} in Leipzig.`,
      `${KONRAD.fullName} und Mehmet-Deniz Celik haben das Studio aufgebaut. Die Türen sind offen – Training läuft. Google: ${GOOGLE_REVIEWS.ratingLabel} bei ${GOOGLE_REVIEWS.countLabel}.`,
    ],
    heroImage: GYM.hall.floor,
    heroAlt: `Trainingsfläche im KONNI MMA GYM Leipzig`,
    storyTitle: 'Für wen',
    story: [
      'Das Gym ist für alle da, die Lust auf Training haben. Egal, ob du gerade anfängst, schon Erfahrung hast, studierst oder nach der Arbeit kommst.',
      'Du kannst mit einer Disziplin starten und später eine zweite dazunehmen. Bei Standard, Flex und Plus sind alle Kurse dabei. Slow Start hält dich bei zwei Einheiten pro Woche.',
      'Unter 18 geht nur mit Elternvollmacht. Vorerfahrung brauchst du nicht.',
    ],
    beats: COPY.disciplines.map((d) => ({
      title: `${d.name} in Leipzig`,
      text: `${d.tagline} ${d.text}`,
    })),
    scheduleNote: 'Was in der Woche läuft',
    schedule: [
      'MMA · MMA Basic · Sparring',
      'BJJ No-Gi',
      'Boxen Basic & Fortgeschrittene',
      'Ringen',
      'K1 / Kick- & Thai-Boxen',
    ],
    placeTitle: 'Adresse',
    place: [
      `${GYM.street}, ${GYM.zip} ${GYM.city}. Kursplan von Montag bis Samstag.`,
      'Erreichbar aus Gohlis, Eutritzsch, Schönefeld, dem Zentrum und dem Umland – unter anderem aus Schkeuditz, Taucha und Markkleeberg.',
    ],
    placeNames: `Gohlis, Eutritzsch, Schönefeld-Abtnaundorf, Mockau, Zentrum, Plagwitz, Lindenau, Connewitz, ${KONRAD.birthPlace}, Taucha, Markkleeberg`,
    voiceTitle: 'Was Mitglieder sagen',
    faqs: [
      {
        q: 'Welche Kampfsportarten kann ich bei euch trainieren?',
        a: 'MMA, Ringen, BJJ No-Gi, Boxen und Kick- & Thai-Boxen / K1. Der Wochenplan steht auf der Startseite.',
      },
      {
        q: 'Was kostet Kampfsport bei KONNI?',
        a: 'Slow Start 79,99€ (2 Kurse/Woche, 12 Monate), Standard 99,99€ (24 Monate), Flex 109,99€ (12 Monate), Plus 119€ (6 Monate). Anmeldegebühr 19,99€. Karte, Apple Pay oder SEPA über Stripe.',
      },
      {
        q: 'Wo ist das Gym?',
        a: `${GYM.street}, ${GYM.zip} ${GYM.city}.`,
      },
      {
        q: 'Gibt es ein Probetraining?',
        a: 'Ja. Online wählst du einen Kurs aus dem Kursplan. Unter 18 brauchen wir die Elternvollmacht.',
      },
    ],
    closeTitle: 'Mitglied werden',
    close: 'Training läuft. Wir freuen uns auf dich auf der Matte.',
    related: [{ id: 'mmaLeipzig', label: 'MMA in Leipzig' }],
    weekAsideStamp: KONRAD.givenName,
    weekAsideTitle: 'Head Coach',
    weekAsideParas: [
      `${KONRAD.fullName} ist aktiver MMA-Profi und Mitgründer. Rekord ${KONRAD.record}, OKTAGON ${KONRAD.oktagonRecord}.`,
      'Gemeinsam mit Mehmet führt er das Gym.',
    ],
  },
}

export const LOCAL_HUB_FOOTER = [
  { id: 'mmaLeipzig' as const, label: 'MMA Leipzig' },
  { id: 'kampfsportLeipzig' as const, label: 'Kampfsport Leipzig' },
]

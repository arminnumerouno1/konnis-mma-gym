import { GYM, GYM_ADDRESS } from './gym'

export type LegalBlock = {
  title: string
  paragraphs: string[]
}

export const IMPRESSUM = {
  eyebrow: 'Angaben gemäß § 5 DDG',
  title: 'Impressum',
  rows: [
    { label: 'Diensteanbieter', value: GYM.legalName },
    { label: 'Vertreten durch', value: GYM.partners.join(' und ') },
    { label: 'Anschrift', value: GYM_ADDRESS },
    { label: 'E-Mail', value: GYM.email },
    { label: 'Inhaltlich verantw.', value: `${GYM.partners.join(', ')} (Anschrift wie oben)` },
  ],
  notes: [
    'Dieses Impressum gilt für die Website KONNI MMA GYM (Leipzig).',
    'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
  ],
} as const

export const PRIVACY: LegalBlock[] = [
  {
    title: '1. Verantwortlicher',
    paragraphs: [
      `Verantwortlich für die Datenverarbeitung ist die ${GYM.legalName}, vertreten durch ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, E-Mail: ${GYM.email}.`,
    ],
  },
  {
    title: '2. Aufruf der Website',
    paragraphs: [
      'Beim Aufruf verarbeitet der Hosting-Dienstleister technisch nötige Server-Logfiles (IP-Adresse, Zeit, aufgerufene Datei, Datenmenge, Browser, ggf. Referrer). Zweck: Auslieferung, Sicherheit, Missbrauchsabwehr (Art. 6 Abs. 1 lit. f DSGVO). Speicherdauer nach den technischen Vorgaben des Hosters.',
    ],
  },
  {
    title: '3. Cookies und Tracking',
    paragraphs: [
      'Diese Website setzt keine Analyse- oder Marketing-Cookies. Schriftarten liegen lokal. Scrollposition und Formularstand bleiben auf deinem Gerät.',
    ],
  },
  {
    title: '4. Mitgliedschaft und Day Pass',
    paragraphs: [
      'Wenn du das Anmeldeformular absendest, verarbeiten wir die angegebenen Vertragsdaten: Name, Geburtsdatum, Anschrift, E-Mail, Telefon, gewählter Tarif, Bestätigungen, digitale Unterschrift, bei Minderjährigen die Daten der gesetzlichen Vertretung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag) sowie Art. 6 Abs. 1 lit. c DSGVO, soweit Aufbewahrungspflichten gelten.',
      'Ohne diese Daten kommt kein Online-Vertrag zustande. Die Daten bleiben für die Vertragsdauer und danach so lange, wie handels- und steuerrechtliche Pflichten das verlangen — in der Regel bis zu zehn Jahre nach Vertragsende.',
      `Du kannst Änderungen von Anschrift, E-Mail und Zahlweg zeitnah an ${GYM.email} schicken.`,
    ],
  },
  {
    title: '5. Optionale Einwilligungen',
    paragraphs: [
      'Foto-/Video-Einwilligung und Newsletter sind freiwillig (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit mit Wirkung für die Zukunft widerrufen — per E-Mail an uns. Der Vertrag bleibt davon unberührt.',
      'Für Infomails kann der EU-Anbieter Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris) als Auftragsverarbeiter eingesetzt werden. Jede Mail hat einen Abmeldelink.',
    ],
  },
  {
    title: '6. Kontakt per E-Mail',
    paragraphs: [
      'Schreibst du uns, nutzen wir deine Angaben zur Antwort (Art. 6 Abs. 1 lit. b oder f DSGVO). Löschung, sobald die Sache erledigt ist und keine Pflicht dagegensteht.',
    ],
  },
  {
    title: '7. Deine Rechte',
    paragraphs: [
      'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Art. 6 Abs. 1 lit. f DSGVO, jeweils nach Art. 15–21 DSGVO. Außerdem Beschwerde bei einer Aufsichtsbehörde. Zuständig u. a.: Sächsische Datenschutz- und Transparenzbeauftragte, Devrientstraße 1, 01067 Dresden (datenschutz.sachsen.de).',
    ],
  },
]

export const AGB: LegalBlock[] = [
  {
    title: 'Kopf',
    paragraphs: [
      `Allgemeine Geschäftsbedingungen der ${GYM.legalName}, vertreten durch die Gesellschafter ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, E-Mail: ${GYM.email}. Nachfolgend „KONNIMMAGYM“ oder „Gym“. Stand: ${GYM.agbStand}.`,
    ],
  },
  {
    title: '§ 1 Geltungsbereich',
    paragraphs: [
      'Diese AGB gelten für sämtliche Mitgliedschaftsverträge zwischen der KONNIMMAGYM GbR und ihren Mitgliedern.',
      'Leistungsumfang, Laufzeit, Beitrag, Anmeldegebühren und besondere Vereinbarungen stehen im jeweiligen Mitgliedsvertrag.',
      'Individuelle Vereinbarungen haben Vorrang vor diesen AGB.',
    ],
  },
  {
    title: '§ 2 Vertragsabschluss und Beginn',
    paragraphs: [
      'Der Vertrag kommt durch Unterzeichnung bzw. Annahme durch Mitglied und KONNIMMAGYM zustande.',
      'Beginn und Dauer ergeben sich aus dem Mitgliedsvertrag.',
      'Wird vor der Eröffnung geschlossen, beginnt die beitragspflichtige Laufzeit grundsätzlich erst mit dem vereinbarten Vertragsbeginn bzw. Eröffnungstermin, soweit nichts anderes steht.',
      'Minderjährige nur mit Zustimmung ihrer gesetzlichen Vertreter.',
    ],
  },
  {
    title: '§ 3 Leistungen',
    paragraphs: [
      'Die Mitgliedschaft berechtigt im Rahmen des Tarifs zur Nutzung der vorgesehenen Flächen, Einrichtungen und Angebote während der geltenden Öffnungs- und Kurszeiten.',
      'Der konkrete Umfang richtet sich nach Tarif bzw. Vertrag.',
      'Kursplan, Zeiten, Trainer, Inhalte und einzelne Bereiche dürfen aus sachlichen Gründen angepasst werden, solange der wesentliche Charakter bleibt und niemand unangemessen benachteiligt wird.',
      'Kein Anspruch auf einen bestimmten Kurs durch einen bestimmten Trainer, außer ausdrücklich vereinbart.',
      'Vorübergehende Änderungen wegen Krankheit, Urlaub, Wettkampf oder Organisation bleiben vorbehalten.',
    ],
  },
  {
    title: '§ 4 Beitrag und Zahlung',
    paragraphs: [
      'Höhe von Beitrag und etwaiger Anmeldegebühr stehen im Mitgliedsvertrag.',
      'Fällig zu den dort genannten Zeitpunkten.',
      'In den Online-Verträgen dieses Gyms ist die Zahlung per eigener Überweisung vereinbart (Vorrang vor der AGB-Standardklausel Lastschrift). Das Gym teilt die Kontoverbindung vor der Eröffnung mit.',
      'AGB-Grundsatz, falls später Lastschrift vereinbart wird: ausreichende Deckung; echte Bankkosten einer vom Mitglied zu vertretenden Rücklastschrift können weitergegeben werden; der Nachweis eines geringeren Schadens bleibt offen; Änderungen der Bankdaten unverzüglich mitteilen.',
    ],
  },
  {
    title: '§ 5 Zahlungsverzug',
    paragraphs: [
      'Es gelten die gesetzlichen Vorschriften.',
      'Nach Mahnung und angemessener Frist kann das Gym bei erheblichen Rückständen vorübergehend die Nutzung sperren, soweit das im Einzelfall passt.',
      'Die Zahlungspflicht bleibt während einer solchen Sperre bestehen.',
      'Außerordentliche Kündigung aus wichtigem Grund bleibt beiden Seiten.',
    ],
  },
  {
    title: '§ 6 Laufzeit und ordentliche Kündigung',
    paragraphs: [
      'Mindestlaufzeit steht im Vertrag: 12 oder 24 Monate.',
      'Kündigung mit einem Monat Frist zum Ende der Mindestlaufzeit.',
      'Ohne fristgerechte Kündigung läuft der Vertrag auf unbestimmte Zeit weiter und ist dann jederzeit mit einem Monat Frist kündbar.',
      `Kündigung in Textform, insbesondere per E-Mail an ${GYM.email}. Maßgeblich ist der Zugang.`,
    ],
  },
  {
    title: '§ 7 Außerordentliche Kündigung',
    paragraphs: [
      'Beide Seiten behalten das Recht aus wichtigem Grund.',
      'Wichtig ist, wenn der anderen Seite die Fortsetzung bis zum normalen Ende nicht zuzumuten ist.',
      'Ob lange Krankheit, Verletzung oder andere persönliche Lagen reichen, richtet sich nach dem Einzelfall und dem Gesetz.',
      'Das Gym kann insbesondere bei erheblichen oder wiederholten Hausordnungs-Verstößen, Gewalt außerhalb des erlaubten Trainings, Bedrohung, schweren Beleidigungen, Diebstahl, vorsätzlicher Sachbeschädigung oder anderen schweren Pflichtverletzungen außerordentlich kündigen.',
      'Soweit die Pflichtverletzung heilbar ist und eine Abmahnung nötig oder zumutbar ist, kommt die außerordentliche Kündigung grundsätzlich erst danach.',
    ],
  },
  {
    title: '§ 8 Ruhen',
    paragraphs: [
      'Kein automatischer Anspruch auf beitragsfreies Ruhen, außer gesetzlich oder ausdrücklich vereinbart.',
      'Auf Antrag kann das Gym aus Kulanz stilllegen — etwa bei langer Krankheit, Verletzung, Schwangerschaft.',
      'Das braucht eine ausdrückliche Bestätigung. Dauer und Wirkung auf Laufzeit und Beitrag werden im Einzelfall festgelegt.',
    ],
  },
  {
    title: '§ 9 Beitragsanpassung',
    paragraphs: [
      'Während der Mindestlaufzeit gilt grundsätzlich der vereinbarte Beitrag, soweit hier nichts anderes steht.',
      'Bei nach Vertragsschluss nachweisbaren Änderungen der maßgeblichen Kosten (Miete, Energie, Personal, Versicherung, Gesetz) darf das Gym den Beitrag angemessen anpassen.',
      'Eine Erhöhung darf nur echte Kostensteigerungen ausgleichen, nicht extra Marge. Steigerungen und Senkungen sind gegeneinander zu rechnen.',
      'Info rechtzeitig vorher in Textform, mit Zeitpunkt und wesentlichen Gründen. Zwingende Rechte bleiben.',
    ],
  },
  {
    title: '§ 10 Öffnungszeiten und Kursplan',
    paragraphs: [
      'Aktuelle Zeiten gibt das Gym bekannt. Sachliche, zumutbare Änderungen sind erlaubt.',
      'An Feiertagen, Weihnachten, Silvester, Neujahr oder bei besonderen Events können Sonderzeiten gelten.',
      'Kurzfristige Ausfälle (Krankheit, Unvorhergesehenes) sind nicht ganz vermeidbar. Ersatz wird nach Möglichkeit gesucht.',
    ],
  },
  {
    title: '§ 11 Einschränkungen und Schließungen',
    paragraphs: [
      'Reparatur, Wartung, Reinigung oder Umbau können Bereiche zeitweise sperren. Das Gym hält das klein.',
      'Gesetzliche Ansprüche bei erheblicher Einschränkung oder Nichtleistung bleiben. Dasselbe bei behördlicher Schließung oder wenn Leistung rechtlich/tatsächlich unmöglich ist.',
    ],
  },
  {
    title: '§ 12 Gesundheit',
    paragraphs: [
      'Kampfsport belastet den Körper und kann verletzen.',
      'Jedes Mitglied trainiert nur im eigenen gesunden Rahmen. Bei Zweifeln: vorher ärztlichen Rat.',
      'Anweisungen der Trainer zur Sicherheit gelten. Techniken nur im vorgesehenen Rahmen und mit Kontrolle.',
    ],
  },
  {
    title: '§ 13 Verhalten und Hausordnung',
    paragraphs: [
      'Die Hausordnung gilt. Respekt gegenüber Mitgliedern, Trainern, Personal, Gästen.',
      'Vorsätzliche oder grob rücksichtslose Gefährdung ist verboten.',
      'Schläge, Tritte, Würfe, Takedowns, Hebel und Chokes nur nach Vorgabe und im richtigen Rahmen. Sparring kontrolliert.',
      'Saubere, passende Kleidung und nötiger Schutz. Kein Training unter erheblichem Einfluss von Alkohol, Drogen oder Rauschmitteln.',
      'Bei erheblichen Verstößen kann das Gym von der Einheit ausschließen.',
    ],
  },
  {
    title: '§ 14 Hygiene',
    paragraphs: [
      'Hygienevorgaben einhalten. Flächen nur mit geeigneter Kleidung und nach Vorgabe nutzen.',
      'Bei ansteckender Krankheit, infektiöser Haut oder Gefahr für andere: kein Training.',
      'Geräte und Räume pfleglich behandeln.',
    ],
  },
  {
    title: '§ 15 Haftung',
    paragraphs: [
      'Unbeschränkt für Leben, Körper, Gesundheit bei Vorsatz oder Fahrlässigkeit des Gyms, seiner Vertreter oder Erfüllungsgehilfen.',
      'Sonstige Schäden: unbeschränkt bei Vorsatz und grober Fahrlässigkeit.',
      'Bei leichter Fahrlässigkeit nur für wesentliche Vertragspflichten und nur den vertragstypischen, vorhersehbaren Schaden.',
      'Im Übrigen ist Haftung für leicht fahrlässige Sach- und Vermögensschäden ausgeschlossen, soweit das Gesetz das zulässt. Gesetzliche Regeln bleiben sonst unberührt.',
    ],
  },
  {
    title: '§ 16 Persönliche Sachen',
    paragraphs: [
      'Eigene Sachen sicherst du selbst. Schließfächer sind keine besondere Verwahrung durch das Gym.',
      'Haftung für Verlust, Beschädigung oder Diebstahl richtet sich nach dem Gesetz und § 15.',
    ],
  },
  {
    title: '§ 17 Beschädigungen',
    paragraphs: [
      'Einrichtungen und Geräte pfleglich behandeln. Schuldhaft verursachter Schaden: gesetzliche Haftung.',
      'Defekte sofort melden.',
    ],
  },
  {
    title: '§ 18 Zutritt',
    paragraphs: [
      'Mitgliedschaft ist persönlich und grundsätzlich nicht übertragbar.',
      'Karten oder Codes nicht weitergeben. Haftung für Schäden durch schuldhafte Weitergabe nach Gesetz.',
    ],
  },
  {
    title: '§ 19 Foto und Video',
    paragraphs: [
      'Aufnahmen, auf denen andere erkennbar sind, nur mit Rücksicht auf deren Rechte und das Gesetz.',
      'Gym-Aufnahmen zu Werbung, auf denen du erkennbar im Mittelpunkt stehst, nur mit Einwilligung oder anderer Rechtsgrundlage. Einwilligung ist für die Zukunft widerrufbar.',
    ],
  },
  {
    title: '§ 20 Datenschutz',
    paragraphs: ['Personenbezogene Daten nach geltendem Datenschutzrecht. Details in der Datenschutzerklärung.'],
  },
  {
    title: '§ 21 Änderung deiner Daten',
    paragraphs: ['Name, Anschrift, E-Mail und ggf. Bankweg zeitnah mitteilen.'],
  },
  {
    title: '§ 22 Widerruf bei Fernabsatz',
    paragraphs: [
      'Kommt der Vertrag nur online, per E-Mail oder außerhalb der Geschäftsräume zustande, können gesetzliche Widerrufsrechte gelten. Dann gibt es eine gesonderte Widerrufsbelehrung inklusive Muster-Formular.',
    ],
  },
  {
    title: '§ 23 Hausordnung',
    paragraphs: [
      'Die Hausordnung ergänzt diese AGB. Bei Widerspruch gewinnt eine individuelle Abrede im Mitgliedsvertrag.',
    ],
  },
  {
    title: '§ 24 Schluss',
    paragraphs: [
      'Es gilt das Recht der Bundesrepublik Deutschland unter Beachtung zwingenden Verbraucherschutzes.',
      'Sind einzelne Klauseln unwirksam, bleiben die anderen. An die Stelle tritt das Gesetz.',
      'Individuelle Änderungen nur im Einvernehmen.',
      `Stand: ${GYM.agbStand}.`,
    ],
  },
]

export const WITHDRAWAL = {
  right: [
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
    'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
    `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ${GYM.legalName}, vertreten durch ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, E-Mail: ${GYM.email}, mittels einer eindeutigen Erklärung (Brief oder E-Mail) über Ihren Entschluss informieren.`,
    'Sie können das Muster-Widerrufsformular verwenden. Pflicht ist das nicht.',
    'Zur Fristwahrung reicht das Absenden vor Ablauf der Frist.',
  ],
  effects: [
    'Widerrufen Sie, zahlen wir alle von Ihnen erhaltenen Zahlungen unverzüglich und spätestens binnen vierzehn Tagen ab Zugang Ihrer Mitteilung zurück.',
    'Für die Rückzahlung nutzen wir dasselbe Zahlungsmittel wie bei der ursprünglichen Zahlung, außer es wurde etwas anderes vereinbart.',
  ],
  used: [
    'Haben Sie ausdrücklich verlangt, dass die KONNIMMAGYM GbR schon in der Widerrufsfrist leistet, und haben Sie in dieser Zeit schon Leistungen genutzt, zahlen Sie dafür angemessenen Wertersatz.',
    'Der Wertersatz richtet sich nach dem Anteil der schon erbrachten Leistung am Gesamtvertrag. Ein schon gezahlter Beitrag wird dann nicht zwingend vollständig erstattet.',
    'Voraussetzung: Sie haben den vorzeitigen Beginn ausdrücklich verlangt und wurden über diese Folge informiert.',
  ],
  early: [
    'Ich verlange ausdrücklich, dass die KONNIMMAGYM GbR schon vor Ablauf der 14 Tage mit der Leistung beginnt.',
    'Mir ist bekannt, dass ich bei Widerruf für schon erbrachte Leistungen Wertersatz zahle und den schon gezahlten Betrag nicht unbedingt vollständig zurückbekomme.',
  ],
  form: [
    `An: ${GYM.legalName}, vertreten durch ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, E-Mail: ${GYM.email}`,
    'Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über folgende Dienstleistung: Mitgliedschaft bei KONNIMMAGYM.',
    'Bitte angeben: Vertragsschluss-Datum, Name, Anschrift, E-Mail, Datum. Unterschrift nur bei Papier.',
  ],
} as const

export const HOUSE_RULES: LegalBlock[] = [
  {
    title: '1. Geltung',
    paragraphs: [
      `Diese Hausordnung gilt für alle Mitglieder, Day-Pass-Gäste und Besucher der ${GYM.legalName}. Sie ergänzt AGB und Mitgliedsvertrag (Stand AGB: ${GYM.agbStand}).`,
    ],
  },
  {
    title: '2. Respekt',
    paragraphs: [
      'Kein Ego-Theater. Keine Beleidigung, keine Drohung, keine Gewalt außerhalb des geleiteten Trainings.',
      'Traineransagen zur Sicherheit gelten sofort.',
    ],
  },
  {
    title: '3. Training',
    paragraphs: [
      'Techniken nur im vorgesehenen Rahmen und mit Kontrolle. Sparring nur nach Vorgabe.',
      'Wer andere gefährdet oder wiederholt gegen Regeln geht, fliegt aus der Einheit. Weiteres richtet sich nach Vertrag und Gesetz.',
    ],
  },
  {
    title: '4. Hygiene und Gesundheit',
    paragraphs: [
      'Saubere Trainingskleidung, nötiger Schutz, Füße und Hände gepflegt. Matten nur so, wie das Gym es vorgibt.',
      'Ansteckende Krankheit, offene infektiöse Haut, Rausch: kein Training.',
      'Jeder prüft selbst, ob der Körper mitmacht, und sagt akute Limits vor der Einheit.',
    ],
  },
  {
    title: '5. Geräte, Käfig, Sachen',
    paragraphs: [
      'Geräte, Käfig und Räume pfleglich. Defekte sofort sagen.',
      'Wertgegenstände bleiben deine Sache. Schließfächer sind keine Verwahrung durch das Gym.',
    ],
  },
  {
    title: '6. Zutritt',
    paragraphs: [
      'Mitgliedschaft und Day Pass sind persönlich. Codes und Karten nicht weitergeben.',
      'Alkohol, Drogen, Waffen: draußen.',
    ],
  },
  {
    title: '7. Foto',
    paragraphs: [
      'Andere Personen nur aufnehmen, wenn deren Rechte das hergeben. Gym-Werbung mit dir im Fokus nur mit Einwilligung oder anderer Grundlage.',
    ],
  },
]

export const CONTRACT_INTRO = {
  '12': 'Tarif mit 12 Monaten anfänglicher Vertragsdauer. Bitte alle Felder vor der Unterschrift füllen.',
  '24': 'Tarif mit 24 Monaten anfänglicher Vertragsdauer. Bitte alle Felder vor der Unterschrift füllen.',
} as const

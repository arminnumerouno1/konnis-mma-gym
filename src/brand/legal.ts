import { GYM, GYM_ADDRESS } from './gym'

export type LegalBlock = {
  title: string
  paragraphs: string[]
}

export const ODR_URL = 'https://ec.europa.eu/consumers/odr/'

export const IMPRESSUM = {
  eyebrow: 'Angaben gemäß § 5 DDG',
  title: 'Impressum',
  rows: [
    { label: 'Diensteanbieter', value: GYM.legalName },
    { label: 'Rechtsform', value: 'Gesellschaft bürgerlichen Rechts (GbR)' },
    { label: 'Vertreten durch', value: `die Gesellschafter ${GYM.partners.join(' und ')}` },
    { label: 'Anschrift', value: `${GYM_ADDRESS}, ${GYM.country}` },
    { label: 'Telefon', value: GYM.phone },
    { label: 'WhatsApp', value: GYM.phone },
    { label: 'E-Mail', value: GYM.email },
    { label: 'E-Mail (Verträge)', value: GYM.legalEmail },
    {
      label: 'Inhaltlich verantwortlich',
      value: `${GYM.partners[0]}, ${GYM_ADDRESS} (gemäß § 18 Abs. 2 MStV)`,
    },
    { label: 'Umsetzung', value: GYM.siteBy.name },
  ],
  notes: [
    'Dieses Impressum gilt für die Website von KONNI MMA GYM einschließlich der Unterseiten, des Online-Mitgliedschaftsformulars und der verlinkten Gym-Kanäle, soweit wir sie selbst betreiben.',
    'Hinweise zu Cookies und zur übrigen Datenverarbeitung stehen in der Datenschutzerklärung. Die Cookie-Auswahl kannst du über den Link Cookies im Footer ändern.',
  ],
  blocks: [
    {
      title: 'Register und Steuernummern',
      paragraphs: [
        'Die KONNI MMA GYM GbR ist nicht ins Handelsregister eingetragen. Eine Handelsregisternummer ist daher nicht anzugeben.',
        'Eine Umsatzsteuer-Identifikationsnummer nach § 27a UStG liegt derzeit nicht vor. Sobald eine erteilt ist, wird sie hier ergänzt.',
        'Eine Wirtschaftsidentifikationsnummer nach § 139c AO wird hier angegeben, sobald sie vorliegt.',
      ],
    },
    {
      title: 'Kontaktaufnahme',
      paragraphs: [
        `Eine schnelle elektronische Kontaktaufnahme ist möglich per E-Mail an ${GYM.email}, telefonisch unter ${GYM.phone} oder über WhatsApp. Wir antworten in der Regel an Werktagen.`,
      ],
    },
    {
      title: 'Haftung für Inhalte',
      paragraphs: [
        'Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.',
        'Nach §§ 8 bis 10 DDG sind wir nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben unberührt.',
        'Eine Haftung hierfür ist erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.',
      ],
    },
    {
      title: 'Haftung für Links',
      paragraphs: [
        'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir keine Gewähr übernehmen. Verantwortlich ist stets der jeweilige Anbieter oder Betreiber der verlinkten Seiten.',
        'Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße geprüft. Rechtswidrige Inhalte waren dabei nicht erkennbar. Eine dauerhafte Kontrolle ohne konkreten Hinweis auf eine Rechtsverletzung ist nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.',
      ],
    },
    {
      title: 'Urheberrecht',
      paragraphs: [
        'Die von uns erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Verwertung außerhalb der gesetzlichen Schranken bedürfen der schriftlichen Zustimmung des jeweiligen Rechteinhabers.',
        'Downloads und Kopien dieser Seiten sind nur für den privaten, nicht kommerziellen Gebrauch gestattet, soweit nicht etwas anderes vereinbart ist.',
        'Soweit Inhalte nicht von uns stammen, sind die Urheberrechte Dritter gekennzeichnet. Wenn du eine Rechtsverletzung entdeckst, schreib uns. Bei berechtigtem Hinweis entfernen wir den Inhalt.',
      ],
    },
    {
      title: 'Online-Streitbeilegung',
      paragraphs: [
        'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. Verbraucher können diese Plattform für die außergerichtliche Beilegung von Streitigkeiten aus Online-Kaufverträgen oder Online-Dienstleistungsverträgen nutzen.',
        `OS-Plattform: ${ODR_URL}`,
        `Unsere E-Mail-Adresse lautet ${GYM.email}.`,
      ],
    },
    {
      title: 'Verbraucherstreitbeilegung',
      paragraphs: [
        'Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
      ],
    },
  ],
} as const

export const PRIVACY: LegalBlock[] = [
  {
    title: '1. Verantwortlicher',
    paragraphs: [
      `Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website und im Zusammenhang mit Mitgliedschaft, Probetraining und Kontakt ist die ${GYM.legalName}, vertreten durch ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, Telefon ${GYM.phone}, E-Mail ${GYM.email}.`,
      'Ein betrieblicher Datenschutzbeauftragter ist gesetzlich nicht bestellt. Für Datenschutzanliegen genügt eine Nachricht an die oben genannte E-Mail-Adresse.',
    ],
  },
  {
    title: '2. Hosting und Server-Logfiles',
    paragraphs: [
      'Die Website wird über einen Hosting-Dienstleister bereitgestellt. Derzeit ist das Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. Der Hoster verarbeitet in unserem Auftrag technisch notwendige Daten zur Auslieferung der Seiten (Art. 28 DSGVO).',
      'Beim Aufruf entstehen Server-Logfiles, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Datei, übertragene Datenmenge, Browsertyp und gegebenenfalls die zuvor besuchte Seite. Zweck sind Bereitstellung, Stabilität, Sicherheit und Missbrauchsabwehr (Art. 6 Abs. 1 lit. f DSGVO). Die Speicherdauer richtet sich nach den technischen Vorgaben des Hosters und ist auf das Erforderliche begrenzt.',
      'Soweit dabei Daten in die USA übermittelt werden, stützt sich das auf den EU-US Data Privacy Framework und/oder geeignete Garantien nach Art. 46 DSGVO.',
      'Adressvorschläge im Anmeldeformular: Wenn du eine Straße eintippst, fragt unser Server den Geocoding-Dienst Photon der komoot GmbH (Potsdam) auf Basis von OpenStreetMap nach passenden Adressen. Übermittelt wird nur der eingetippte Text, nicht deine IP-Adresse und keine weiteren Formulardaten. Zweck ist eine schnelle, fehlerfreie Eingabe (Art. 6 Abs. 1 lit. b und f DSGVO).',
    ],
  },
  {
    title: '3. Cookies und deine Auswahl',
    paragraphs: [
      'Beim ersten Besuch erscheint unten auf der Seite ein Hinweis. Du entscheidest dort, ob nur technisch nötige Cookies gesetzt werden oder auch optionale Dienste.',
      'Deine Auswahl speichern wir im Cookie konni_consent und zusätzlich im lokalen Speicher deines Browsers. Laufzeit: 180 Tage. Danach fragen wir erneut. Ändern sich die Kategorien wesentlich, fragen wir ebenfalls neu. Ohne diese Speicherung müsste der Hinweis bei jedem Aufruf wieder kommen.',
      'Technisch nötig ist nur das, was die Website und deine Entscheidung brauchen. Rechtsgrundlage sind § 25 Abs. 2 TDDDG und Art. 6 Abs. 1 lit. f DSGVO. Wenn du dieses Cookie ablehnst oder löschst, erscheint der Hinweis wieder.',
      'Optionale Dienste setzen wir nur, wenn du „Alle an“ wählst oder die optionale Kategorie einschaltest und speicherst. Aktuell ist das die eingebettete OpenStreetMap-Karte auf der Kontaktseite. Rechtsgrundlage sind dann Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG.',
      'Die Einwilligung kannst du jederzeit über „Cookies“ im Footer oder über „Auswahl ändern“ auf dieser Seite widerrufen oder anpassen. Der Widerruf gilt ab dem Zeitpunkt der Änderung. Die Rechtmäßigkeit bis dahin bleibt unberührt.',
      'Ohne optionale Zustimmung setzen wir keine Analyse-, Werbe- oder Marketing-Cookies und keine Tracking-Pixel. Es gibt kein Google Analytics, kein Meta-Pixel und keine eingebetteten Social-Plugins. Schriftarten liegen lokal auf unserem Server.',
      'Instagram und Google Maps sind auf der Website nur als normale Links. Beim Klick verlässt du unsere Seite; es gelten die Hinweise der jeweiligen Anbieter. Eingebettete Inhalte Dritter laden wir erst, wenn du optionale Dienste erlaubt hast.',
      'Technische Zustände wie Scrollposition oder Formulareingaben können vorübergehend in deinem Browser bleiben, soweit das für die jeweilige Funktion nötig ist.',
    ],
  },
  {
    title: '4. Kontakt, Probetraining, Voranmeldung, WhatsApp',
    paragraphs: [
      `Schreibst du uns per Formular, E-Mail oder Telefon, verarbeiten wir die angegebenen Daten zur Bearbeitung und Antwort (Art. 6 Abs. 1 lit. b DSGVO bei vorvertraglicher Anfrage, sonst Art. 6 Abs. 1 lit. f DSGVO).`,
      `Das Probetraining-Formular erfasst Name, E-Mail, Telefon, gewünschtes Training und optional eine Nachricht. Die Angaben gehen an ${GYM.email}.`,
      `Die Voranmeldung unter /voranmeldung erfasst Name, Alter, E-Mail, optional Telefon, deine Antworten zu Sportarten, Erfahrung, Trainingszeiten, Eröffnungspreis, wie du von uns erfahren hast und deinem Ziel sowie optional eine Nachricht. Wir speichern das in unserer Mitgliederverwaltung (Hosting und Speicher bei Vercel), um das Training zu planen und dich zur Eröffnung, zu Probetrainings und zur Mitgliedschaft zu kontaktieren. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit per Mail an ${GYM.email} widerrufen; dann löschen wir deine Voranmeldung. Wirst du kein Mitglied, löschen wir sie spätestens zwölf Monate nach der Eröffnung.`,
      'Bietest du uns WhatsApp an oder nutzt du unseren WhatsApp-Link, werden Inhalte und Metadaten über WhatsApp Ireland Limited / Meta verarbeitet. WhatsApp hat eigene Datenschutzhinweise. Die Nutzung ist freiwillig; du kannst uns stattdessen per E-Mail oder Telefon erreichen.',
      'Anfragen löschen wir, sobald die Sache erledigt ist und keine Aufbewahrungspflicht entgegensteht.',
    ],
  },
  {
    title: '5. Mitgliedschaft und Day Pass',
    paragraphs: [
      'Beim Online-Vertrag verarbeiten wir die angegebenen Vertragsdaten: Name, Geburtsdatum, Anschrift, E-Mail, Telefon, Tarif, Bestätigungen, digitale Unterschrift, bei Minderjährigen die Daten der gesetzlichen Vertretung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und Art. 6 Abs. 1 lit. c DSGVO, soweit gesetzliche Aufbewahrung gilt.',
      'Die Monatsbeiträge der 12- und 24-Monats-Verträge werden per SEPA-Lastschrift eingezogen. IBAN, Kontoinhaber und Mandatsdaten verarbeiten wir zur Zahlung (Art. 6 Abs. 1 lit. b DSGVO), sobald du sie uns mitteilst.',
      'Ohne diese Daten kommt kein Online-Vertrag zustande. Die Daten bleiben für die Vertragsdauer und danach so lange, wie handels- und steuerrechtliche Pflichten das verlangen — in der Regel bis zu zehn Jahre nach Vertragsende.',
      `Änderungen von Anschrift, E-Mail, Bankverbindung und Zahlweg bitte zeitnah an ${GYM.legalEmail}.`,
    ],
  },
  {
    title: '6. Optionale Einwilligungen',
    paragraphs: [
      'Foto- und Videoaufnahmen für die Kanäle des Gyms sowie Infomails zum Start und Kursplan sind freiwillig (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit mit Wirkung für die Zukunft widerrufen — per E-Mail an uns. Der Mitgliedsvertrag bleibt davon unberührt.',
      'Für Infomails kann der EU-Anbieter Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankreich) als Auftragsverarbeiter eingesetzt werden. Jede Mail hat einen Abmeldelink.',
    ],
  },
  {
    title: '7. Videoüberwachung',
    paragraphs: [
      'In gekennzeichneten Bereichen des Studios kann eine Videoüberwachung erfolgen, soweit eine datenschutzrechtliche Grundlage besteht. Zweck, Rechtsgrundlage, überwachte Bereiche, Speicherdauer und Empfänger werden dann vor Ort und in einer ergänzenden Datenschutzinformation zur Videoüberwachung genannt.',
      'Rechtsgrundlage ist in der Regel Art. 6 Abs. 1 lit. f DSGVO (Hausrecht, Sicherheit, Aufklärung von Diebstahl oder Sachbeschädigung). Die Kameras werden auf das Erforderliche beschränkt.',
      'Umkleide-, Dusch- und Sanitärräume werden nicht videoüberwacht. Eine pauschale Zustimmung in den AGB ersetzt diese Hinweise nicht.',
    ],
  },
  {
    title: '8. Instagram, OpenStreetMap und andere Links',
    paragraphs: [
      `Wir verlinken unseren Instagram-Account ${GYM.instagramHandle} (${GYM.instagram}). Beim Klick verlässt du unsere Website. Es gelten die Hinweise von Meta Platforms Ireland Limited.`,
      'Auf unserer Seite ist kein Instagram-Plugin und kein eingebetteter Feed aktiv. Ohne Klick und ohne optionale Cookie-Zustimmung werden keine Daten an Instagram übertragen.',
      'Die Studioadresse verlinken wir auf OpenStreetMap. Der bloße Link überträgt keine Daten an OpenStreetMap.',
      'Wenn du optionale Dienste erlaubst, laden wir zusätzlich eine Karte von openstreetmap.org. Dabei kann die OpenStreetMap Foundation (St John’s Innovation Centre, Cowley Road, Cambridge CB4 0WS, Vereinigtes Königreich) deine IP-Adresse, technische Browserdaten und eigene Cookies verarbeiten. Hinweise der OSM Foundation: https://wiki.osmfoundation.org/wiki/Privacy_Policy',
      'Rechtsgrundlage für die eingebettete Karte ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Ohne diese Zustimmung bleibt es beim normalen Link. Die Einwilligung kannst du über Cookies im Footer jederzeit ändern. Nach dem Widerruf laden wir die Karte nicht mehr. Cookies, die OpenStreetMap selbst gesetzt hat, kannst du nur in deinem Browser löschen.',
    ],
  },
  {
    title: '9. Empfänger',
    paragraphs: [
      'Empfänger können sein: unser Hosting-Dienstleister, der E-Mail-Dienstleister, soweit eingesetzt, sowie Stellen, denen wir gesetzlich zur Auskunft verpflichtet sind.',
      'Eine Übermittlung zu eigenen Werbezwecken an Dritte findet nicht statt.',
    ],
  },
  {
    title: '10. Speicherdauer',
    paragraphs: [
      'Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck nötig ist oder das Gesetz uns eine Frist setzt. Vertrags- und Buchhaltungsunterlagen in der Regel bis zu zehn Jahre, Korrespondenz oft kürzer, Logs nur technisch nötig.',
    ],
  },
  {
    title: '11. Deine Rechte',
    paragraphs: [
      'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Art. 6 Abs. 1 lit. f DSGVO (Art. 15–21 DSGVO). Eine Einwilligung kannst du jederzeit widerrufen; die Rechtmäßigkeit bis zum Widerruf bleibt unberührt.',
      'Außerdem hast du das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO). Für uns zuständig ist unter anderem die Sächsische Datenschutz- und Transparenzbeauftragte, Devrientstraße 1, 01067 Dresden, https://www.datenschutz.sachsen.de.',
    ],
  },
  {
    title: '12. Pflichtangaben, keine automatisierten Entscheidungen',
    paragraphs: [
      'Für den Vertrag sind die dort abgefragten Angaben nötig. Ohne sie können wir die Mitgliedschaft nicht schließen.',
      'Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt.',
    ],
  },
  {
    title: '13. Minderjährige',
    paragraphs: [
      'Mitgliedschaften unter 18 Jahren schließen wir nur mit Vertrag und Zustimmung der gesetzlichen Vertretung. Deren Kontaktdaten verarbeiten wir zur Durchführung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO).',
    ],
  },
  {
    title: '14. Änderung dieser Hinweise',
    paragraphs: [
      `Diese Datenschutzerklärung gilt ab dem ${GYM.agbStand}. Wird die Verarbeitung wesentlich geändert, passen wir den Text an und stellen die neue Fassung auf dieser Seite bereit.`,
    ],
  },
]

export const COOKIE_TABLE = [
  {
    name: 'konni_consent',
    kind: 'Technisch nötig',
    place: 'Cookie und lokaler Speicher',
    time: '180 Tage',
    why: 'Speichert deine Auswahl (nur nötige oder auch optional) und den Zeitpunkt.',
  },
  {
    name: 'Cookies von openstreetmap.org',
    kind: 'Optional',
    place: 'Drittanbieter, nur nach Zustimmung',
    time: 'nach Anbieter',
    why: 'Nur wenn die eingebettete Karte geladen wird. Setzt OpenStreetMap, nicht wir.',
  },
] as const

export const AGB: LegalBlock[] = [
  {
    title: 'Kopf',
    paragraphs: [
      `Allgemeine Geschäftsbedingungen der ${GYM.legalName}, vertreten durch die Gesellschafter ${GYM.partners.join(' und ')}, ${GYM_ADDRESS}, E-Mail: ${GYM.legalEmail}. Stand: ${GYM.agbStand}.`,
    ],
  },
  {
    title: '§ 1 Geltungsbereich',
    paragraphs: [
      '1. Diese Allgemeinen Geschäftsbedingungen gelten für sämtliche Mitgliedschaftsverträge zwischen der KONNI MMA GYM GbR und ihren Mitgliedern. Soweit ausdrücklich bestimmt, gelten einzelne Regelungen auch für Probetrainierende, Tagesgäste und sonstige Trainingsteilnehmer.',
      '2. Der konkrete Leistungsumfang, die Vertragslaufzeit, der Mitgliedsbeitrag, etwaige Anmeldegebühren sowie besondere Vereinbarungen ergeben sich aus dem jeweiligen Mitgliedsvertrag.',
      '3. Individuelle Vereinbarungen zwischen der KONNI MMA GYM GbR und dem Mitglied haben Vorrang vor diesen Allgemeinen Geschäftsbedingungen.',
    ],
  },
  {
    title: '§ 2 Vertragsabschluss und Beginn der Mitgliedschaft',
    paragraphs: [
      '1. Der Mitgliedschaftsvertrag kommt durch Unterzeichnung beziehungsweise Annahme des Mitgliedsvertrages durch das Mitglied und die KONNI MMA GYM GbR zustande. Bei einem elektronischen Vertragsschluss gelten zusätzlich die hierfür einschlägigen gesetzlichen Vorschriften.',
      '2. Beginn und Dauer der Mitgliedschaft ergeben sich aus dem jeweiligen Mitgliedsvertrag.',
      '3. Sofern ein Vertrag bereits vor der Eröffnung des Studios abgeschlossen wird, beginnt die beitragspflichtige Vertragslaufzeit grundsätzlich erst mit dem im Mitgliedsvertrag vereinbarten Vertragsbeginn beziehungsweise Eröffnungstermin, soweit keine abweichende Vereinbarung getroffen wurde.',
      '4. Minderjährige können nur mit Zustimmung ihrer gesetzlichen Vertreter Mitglied werden. Die KONNI MMA GYM GbR kann für Minderjährige einzelne Trainingsformen, insbesondere Sparring, Kontakttraining, Würge-, Hebel- oder vergleichbare Techniken, alters- und entwicklungsabhängig beschränken oder von einer Freigabe durch den verantwortlichen Trainer abhängig machen.',
    ],
  },
  {
    title: '§ 3 Leistungen',
    paragraphs: [
      '1. Die Mitgliedschaft berechtigt das Mitglied im Rahmen des vereinbarten Tarifs zur Nutzung der hierfür vorgesehenen Trainingsflächen, Einrichtungen und Trainingsangebote während der jeweils geltenden Öffnungs- und Kurszeiten.',
      '2. Der konkrete Umfang der Mitgliedschaft richtet sich nach dem abgeschlossenen Tarif beziehungsweise Mitgliedsvertrag.',
      '3. Die KONNI MMA GYM GbR ist berechtigt, Kursplan, Trainingszeiten, Trainer, Trainingsinhalte sowie die Nutzung einzelner Trainingsbereiche aus sachlichen Gründen anzupassen, soweit der wesentliche Charakter der vereinbarten Mitgliedschaft erhalten bleibt und das Mitglied nicht unangemessen benachteiligt wird.',
      '4. Ein Anspruch auf die Durchführung eines bestimmten Kurses durch einen bestimmten Trainer besteht nicht, soweit dies nicht ausdrücklich individuell vereinbart wurde.',
      '5. Vorübergehende Änderungen des Kursplans, insbesondere aufgrund von Krankheit, Urlaub, Wettkämpfen, Veranstaltungen oder sonstigen organisatorischen Gründen, bleiben vorbehalten.',
    ],
  },
  {
    title: '§ 4 Mitgliedsbeitrag und Zahlungsweise',
    paragraphs: [
      '1. Die Höhe des Mitgliedsbeitrags und einer gegebenenfalls vereinbarten Anmeldegebühr ergeben sich aus dem jeweiligen Mitgliedsvertrag.',
      '2. Die Beiträge sind zu den im Mitgliedsvertrag vereinbarten Zeitpunkten fällig.',
      '3. Die Zahlung erfolgt grundsätzlich per SEPA-Lastschrift, sofern keine andere Zahlungsweise vereinbart wurde.',
      '4. Das Mitglied verpflichtet sich, für eine ausreichende Deckung des angegebenen Kontos zu sorgen.',
      '5. Entstehen durch eine vom Mitglied zu vertretende Rücklastschrift tatsächliche Bank- oder Rücklastschriftkosten, können diese in tatsächlich entstandener Höhe berechnet werden. Dem Mitglied bleibt der Nachweis gestattet, dass kein oder ein geringerer Schaden entstanden ist.',
      '6. Änderungen der Bankverbindung oder sonstiger für die Zahlungsabwicklung erforderlicher Daten sind unverzüglich mitzuteilen.',
    ],
  },
  {
    title: '§ 5 Zahlungsverzug',
    paragraphs: [
      '1. Gerät das Mitglied mit fälligen Zahlungen in Verzug, gelten die gesetzlichen Vorschriften.',
      '2. Die KONNI MMA GYM GbR ist berechtigt, das Mitglied nach vorheriger Mahnung und angemessener Zahlungsfrist bis zur Begleichung erheblicher Zahlungsrückstände vorübergehend von der Nutzung des Studios auszuschließen, soweit dies unter Berücksichtigung der Umstände des Einzelfalls angemessen ist.',
      '3. Die Verpflichtung zur Zahlung berechtigter Mitgliedsbeiträge bleibt während eines vom Mitglied zu vertretenden Nutzungsausschlusses bestehen.',
      '4. Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.',
    ],
  },
  {
    title: '§ 6 Vertragslaufzeit und ordentliche Kündigung',
    paragraphs: [
      '1. Die vereinbarte Mindestvertragslaufzeit ergibt sich aus dem Mitgliedsvertrag und darf die gesetzlich zulässige Höchstdauer nicht überschreiten.',
      '2. Bei einer vereinbarten Mindestvertragslaufzeit von 12 Monaten läuft der Vertrag zunächst für 12 Monate; bei 24 Monaten zunächst für 24 Monate.',
      '3. Die Mitgliedschaft kann mit einer Frist von einem Monat zum Ende der vereinbarten Mindestvertragslaufzeit gekündigt werden.',
      '4. Wird die Mitgliedschaft nicht fristgerecht zum Ende der Mindestvertragslaufzeit gekündigt, verlängert sie sich auf unbestimmte Zeit. Danach kann sie jederzeit mit einer Frist von einem Monat gekündigt werden.',
      '5. Die Kündigung kann insbesondere in Textform, beispielsweise per E-Mail an info@mma-in-leipzig.de, erklärt werden. Maßgeblich für die Einhaltung der Kündigungsfrist ist der Zugang der Kündigung.',
      '6. Soweit Verbrauchern über eine Webseite der Abschluss eines unter § 312k BGB fallenden Dauerschuldverhältnisses ermöglicht wird, wird die gesetzlich erforderliche Kündigungsschaltfläche einschließlich Bestätigungsseite bereitgestellt.',
    ],
  },
  {
    title: '§ 7 Außerordentliche Kündigung',
    paragraphs: [
      '1. Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.',
      '2. Ein wichtiger Grund liegt vor, wenn der kündigenden Partei unter Berücksichtigung aller Umstände des Einzelfalls und der Interessen beider Vertragsparteien die Fortsetzung des Vertrags bis zum regulären Vertragsende nicht zugemutet werden kann.',
      '3. Ob insbesondere eine längerfristige Erkrankung, Verletzung oder sonstige persönliche Veränderung einen wichtigen Grund darstellt, richtet sich nach den Umständen des Einzelfalls und den gesetzlichen Bestimmungen.',
      '4. Die KONNI MMA GYM GbR kann insbesondere bei erheblichen oder wiederholten Verstößen gegen Hausordnung oder Sicherheitsregeln, bei Gewalt außerhalb des zulässigen Trainings- oder Wettkampfgeschehens, Bedrohungen, erheblichen Beleidigungen, Diebstahl, vorsätzlicher Sachbeschädigung oder sonstigen schwerwiegenden Pflichtverletzungen außerordentlich kündigen.',
      '5. Soweit eine Abmahnung rechtlich erforderlich oder zumutbar ist, erfolgt die außerordentliche Kündigung grundsätzlich erst nach vorheriger erfolgloser Abmahnung.',
    ],
  },
  {
    title: '§ 8 Ruhen der Mitgliedschaft',
    paragraphs: [
      '1. Ein automatischer Anspruch auf Ruhen oder beitragsfreie Stilllegung besteht nur, soweit dies gesetzlich vorgesehen oder ausdrücklich vertraglich vereinbart wurde.',
      '2. Auf Antrag kann aus Kulanz eine vorübergehende Stilllegung vereinbart werden, insbesondere bei längerfristiger Krankheit, Verletzung, Schwangerschaft oder vergleichbaren Umständen.',
      '3. Eine solche Vereinbarung bedarf einer ausdrücklichen Bestätigung. Dauer und Auswirkungen auf Vertragslaufzeit und Beiträge werden im jeweiligen Einzelfall festgelegt.',
    ],
  },
  {
    title: '§ 9 Anpassung der Mitgliedsbeiträge',
    paragraphs: [
      '1. Während einer vereinbarten Mindestvertragslaufzeit ist die KONNI MMA GYM GbR grundsätzlich an den vereinbarten Mitgliedsbeitrag gebunden, soweit nachfolgend nichts anderes wirksam vereinbart ist.',
      '2. Eine Beitragsanpassung kommt nur in Betracht, wenn sich nach Vertragsschluss Kostenpositionen, die für die vertragliche Leistungserbringung wesentlich sind, nachweisbar verändern. Hierzu können insbesondere Miet-, Energie-, Personal-, Versicherungs- oder gesetzlich verursachte Kosten gehören.',
      '3. Eine Erhöhung darf nur dem angemessenen Ausgleich tatsächlich eingetretener und für die Leistungserbringung relevanter Kostensteigerungen dienen. Kostensenkungen in denselben Kostenpositionen sind angemessen gegenzurechnen. Eine Erhöhung allein zur zusätzlichen Steigerung der Gewinnmarge ist ausgeschlossen.',
      '4. Das Mitglied wird vor Inkrafttreten einer beabsichtigten Anpassung in Textform über Zeitpunkt, Umfang und wesentliche Gründe informiert.',
      '5. Zwingende gesetzliche Rechte des Mitglieds bleiben unberührt.',
    ],
  },
  {
    title: '§ 10 Öffnungszeiten und Kursplan',
    paragraphs: [
      '1. Die jeweils aktuellen Öffnungs- und Kurszeiten werden bekannt gegeben.',
      '2. Öffnungs- und Kurszeiten dürfen aus sachlichen Gründen in einem für die Mitglieder zumutbaren Umfang verändert werden.',
      '3. An gesetzlichen Feiertagen sowie insbesondere zu Weihnachten, Silvester, Neujahr oder bei besonderen Veranstaltungen können gesonderte Öffnungs- oder Kurszeiten gelten.',
      '4. Kurzfristige Kursausfälle aufgrund von Krankheit oder anderen nicht vorhersehbaren Umständen können nicht vollständig ausgeschlossen werden. Nach Möglichkeit werden Ersatzangebote bereitgestellt.',
    ],
  },
  {
    title: '§ 11 Vorübergehende Einschränkungen und Schließungen',
    paragraphs: [
      '1. Bei notwendigen Reparatur-, Wartungs-, Reinigungs- oder Umbaumaßnahmen können einzelne Bereiche vorübergehend nicht oder nur eingeschränkt nutzbar sein.',
      '2. Solche Einschränkungen werden nach Möglichkeit so gering wie möglich gehalten.',
      '3. Gesetzliche Ansprüche des Mitglieds bei erheblichen Einschränkungen oder vollständiger Nichtbereitstellung der vertraglich geschuldeten Leistungen bleiben unberührt.',
      '4. Gleiches gilt für behördlich angeordnete Schließungen oder sonstige Fälle, in denen die vereinbarten Leistungen aus rechtlichen oder tatsächlichen Gründen nicht erbracht werden können.',
    ],
  },
  {
    title: '§ 12 Gesundheit, Eigenverantwortung und sportarttypische Risiken',
    paragraphs: [
      '1. Kampfsport und körperliches Training sind mit körperlichen Belastungen und Verletzungsrisiken verbunden. Dies gilt insbesondere für MMA, Boxen, Kickboxen, Muay Thai, Grappling und vergleichbare Kontakt- und Zweikampfsportarten.',
      '2. Zu den sportarttypischen Risiken können insbesondere Prellungen, Schürf- und Schnittverletzungen, Verstauchungen, Muskel- und Sehnenverletzungen, Gelenkverletzungen, Knochenbrüche sowie Verletzungen infolge von Schlägen, Tritten, Würfen, Takedowns, Hebeln oder Würgetechniken gehören. Diese Aufzählung ist nicht abschließend.',
      '3. Jedes Mitglied hat seine individuellen gesundheitlichen Voraussetzungen zu berücksichtigen und nur in einem seinem Gesundheits- und Leistungszustand entsprechenden Umfang zu trainieren. Bei gesundheitlichen Zweifeln wird empfohlen, vor Aufnahme oder Fortsetzung des Trainings ärztlichen Rat einzuholen.',
      '4. Akute Verletzungen, erhebliche Beschwerden oder sonstige Umstände, die eine sichere Teilnahme erkennbar beeinträchtigen, sind dem Trainer vor Beginn beziehungsweise unverzüglich während des Trainings mitzuteilen, soweit dies möglich und zumutbar ist.',
      '5. Eine Übung oder ein Sparring ist unverzüglich zu unterbrechen, wenn eine sichere Fortsetzung aus gesundheitlichen Gründen nicht möglich erscheint.',
      '6. Die Anerkennung sportarttypischer Risiken stellt keinen Ausschluss oder keine Einschränkung gesetzlicher Haftungsansprüche gegen die KONNI MMA GYM GbR dar.',
    ],
  },
  {
    title: '§ 13 Verhalten im Training, Sparring und Weisungen',
    paragraphs: [
      '1. Die geltende Hausordnung und die Sicherheitsanweisungen sind einzuhalten. Den Anweisungen der Trainer und des Personals ist insbesondere in Sicherheitsfragen Folge zu leisten.',
      '2. Techniken, insbesondere Schläge, Tritte, Würfe, Takedowns, Hebel- und Würgetechniken, dürfen nur entsprechend den Vorgaben des Trainers und im vorgesehenen Trainingsrahmen eingesetzt werden.',
      '3. Sparring ist kontrolliert, rücksichtsvoll und entsprechend den Vorgaben des Trainers durchzuführen. Vereinbarte Intensitäten und Abbruchsignale sind einzuhalten.',
      '4. Trainer sind berechtigt, Sparring oder Übungen jederzeit zu unterbrechen oder einzelne Personen davon auszuschließen, wenn dies aus Sicherheitsgründen geboten erscheint, insbesondere bei erkennbarer Überforderung, Kontrollverlust, unangemessener Härte, erheblichen Leistungsunterschieden, ungeeigneter Ausrüstung, gesundheitlichen Auffälligkeiten oder wiederholten Regelverstößen.',
      '5. Vorsätzliche oder grob rücksichtslose Gefährdungen anderer Personen sowie die Anwendung von Kampftechniken außerhalb des vorgesehenen Trainings- oder Wettkampfrahmens sind untersagt.',
      '6. Das Training unter erheblichem Einfluss von Alkohol, Drogen oder sonstigen berauschenden Substanzen ist untersagt.',
    ],
  },
  {
    title: '§ 14 Schutzausrüstung und Trainingskleidung',
    paragraphs: [
      '1. Geeignete und hygienisch einwandfreie Trainingskleidung ist zu verwenden.',
      '2. Für bestimmte Trainingsformen kann geeignete Schutzausrüstung verbindlich vorgeschrieben werden, insbesondere Mundschutz, Boxhandschuhe, Schienbeinschutz, Tiefschutz oder vergleichbare Schutzausrüstung.',
      '3. Ohne vorgeschriebene oder erkennbar erforderliche Schutzausrüstung kann die Teilnahme an der jeweiligen Trainingsform untersagt werden.',
      '4. Persönliche Schutzausrüstung ist in ordnungsgemäßem und sicherem Zustand zu halten, soweit sie nicht vom Studio gestellt wird.',
    ],
  },
  {
    title: '§ 15 Hygiene und Infektionsschutz',
    paragraphs: [
      '1. Die im Studio geltenden Hygienevorgaben sind einzuhalten.',
      '2. Bei ansteckenden Erkrankungen, infektiösen Hautveränderungen, offenen oder nicht ausreichend abgedeckten Wunden oder sonstigen gesundheitlichen Umständen, durch die andere Personen gefährdet werden können, darf am Training nicht teilgenommen werden.',
      '3. Trainingsgeräte, Matten und sonstige Einrichtungen sind pfleglich und bestimmungsgemäß zu behandeln.',
      '4. Bei konkreten Anhaltspunkten für ein relevantes Infektions- oder Hygienerisiko kann eine Person bis zur Klärung vom Training ausgeschlossen werden, soweit dies zum Schutz anderer erforderlich und verhältnismäßig ist.',
    ],
  },
  {
    title: '§ 16 Probetraining, Gasttraining und Tageskarten',
    paragraphs: [
      '1. Für Probetrainierende, Gäste und Inhaber von Tageskarten gelten die Sicherheits-, Gesundheits-, Hygiene-, Verhaltens- und Haftungsregelungen dieser AGB entsprechend, soweit sie auf das jeweilige Nutzungsverhältnis anwendbar sind.',
      '2. Ein Anspruch auf Teilnahme an jeder Trainingsform, insbesondere an Sparring oder intensivem Kontakttraining, besteht nicht. Der zuständige Trainer entscheidet unter Berücksichtigung von Erfahrung, Leistungsstand und Sicherheit über die Teilnahme.',
      '3. Probetrainierende und Gäste haben den Anweisungen der Trainer und des Personals Folge zu leisten und vorgeschriebene Schutzausrüstung zu verwenden.',
      '4. Bei Minderjährigen kann vor der Teilnahme die Zustimmung eines gesetzlichen Vertreters verlangt werden.',
    ],
  },
  {
    title: '§ 17 Haftung',
    paragraphs: [
      '1. Die KONNI MMA GYM GbR haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer vorsätzlichen oder fahrlässigen Pflichtverletzung der KONNI MMA GYM GbR, ihrer gesetzlichen Vertreter oder Erfüllungsgehilfen beruhen.',
      '2. Für sonstige Schäden haftet die KONNI MMA GYM GbR bei Vorsatz und grober Fahrlässigkeit unbeschränkt.',
      '3. Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht haftet die KONNI MMA GYM GbR für den vertragstypischen, vorhersehbaren Schaden.',
      '4. Im Übrigen ist die Haftung für leicht fahrlässig verursachte Sach- und Vermögensschäden ausgeschlossen, soweit gesetzlich zulässig.',
      '5. Die gesetzlichen Haftungsvorschriften bleiben im Übrigen unberührt.',
      '6. Die Teilnahme an einer Kampfsportart und die Kenntnis sportarttypischer Risiken führen nicht zu einem Ausschluss der Haftung für schuldhafte Pflichtverletzungen.',
    ],
  },
  {
    title: '§ 18 Versicherungsschutz',
    paragraphs: [
      '1. Die KONNI MMA GYM GbR schuldet dem Mitglied keinen individuellen privaten Unfallversicherungsschutz, soweit ein solcher nicht ausdrücklich im Mitgliedsvertrag vereinbart ist.',
      '2. Dem Mitglied steht es frei, für sportarttypische Unfall- und Verletzungsrisiken eigenen privaten Versicherungsschutz abzuschließen.',
      '3. Diese Regelung beschränkt weder die gesetzliche Haftung der KONNI MMA GYM GbR noch gesetzliche oder vertragliche Ansprüche des Mitglieds.',
    ],
  },
  {
    title: '§ 19 Persönliche Gegenstände und Wertgegenstände',
    paragraphs: [
      '1. Mitglieder sind selbst dafür verantwortlich, mitgebrachte persönliche Gegenstände angemessen zu sichern.',
      '2. Soweit Schließfächer oder sonstige Aufbewahrungsmöglichkeiten zur Verfügung gestellt werden, stellen diese grundsätzlich keine gesonderte Verwahrung dar.',
      '3. Die Haftung hinsichtlich verlorener, beschädigter oder entwendeter Gegenstände richtet sich nach den gesetzlichen Vorschriften und § 17 dieser AGB.',
    ],
  },
  {
    title: '§ 20 Beschädigungen',
    paragraphs: [
      '1. Einrichtungen, Trainingsgeräte und sonstiges Eigentum sind pfleglich zu behandeln.',
      '2. Verursacht ein Mitglied schuldhaft einen Schaden, haftet es nach den gesetzlichen Vorschriften.',
      '3. Schäden oder Defekte an Geräten und Einrichtungen sind unverzüglich mitzuteilen.',
    ],
  },
  {
    title: '§ 21 Zutritt und Weitergabe der Mitgliedschaft',
    paragraphs: [
      '1. Die Mitgliedschaft ist persönlich und grundsätzlich nicht übertragbar.',
      '2. Zugangskarten, Zugangscodes oder vergleichbare Zutrittsmittel dürfen nicht an Dritte weitergegeben werden.',
      '3. Das Mitglied haftet nach den gesetzlichen Vorschriften für Schäden, die es durch eine schuldhafte unberechtigte Weitergabe seines Zutrittsmittels verursacht.',
    ],
  },
  {
    title: '§ 22 Foto- und Videoaufnahmen zu privaten oder Marketingzwecken',
    paragraphs: [
      '1. Foto- und Videoaufnahmen, auf denen andere Mitglieder, Gäste, Trainer oder Beschäftigte erkennbar sind, dürfen nur unter Beachtung ihrer Persönlichkeitsrechte und der geltenden gesetzlichen Bestimmungen erstellt und veröffentlicht werden.',
      '2. Das Fotografieren oder Filmen kann in bestimmten Bereichen oder während bestimmter Trainingsformen aus Gründen des Persönlichkeits-, Datenschutz- oder Sicherheitsrechts untersagt werden.',
      '3. Foto- oder Videoaufnahmen durch die KONNI MMA GYM GbR zu Werbe- oder Marketingzwecken, auf denen ein Mitglied erkennbar im Mittelpunkt steht oder identifizierbar abgebildet wird, erfolgen nur auf Grundlage einer erforderlichen Einwilligung oder einer sonstigen gesetzlichen Rechtsgrundlage.',
      '4. Eine erteilte Einwilligung kann im Rahmen der gesetzlichen Voraussetzungen für die Zukunft widerrufen werden.',
    ],
  },
  {
    title: '§ 23 Videoüberwachung',
    paragraphs: [
      '1. In gekennzeichneten Bereichen des Studios kann eine Videoüberwachung erfolgen, soweit und solange hierfür eine datenschutzrechtliche Rechtsgrundlage besteht und die gesetzlichen Voraussetzungen eingehalten werden.',
      '2. Die Videoüberwachung erfolgt nicht auf Grundlage einer pauschalen Zustimmung zu diesen AGB. Zweck, Rechtsgrundlage, überwachte Bereiche, Speicherdauer, Empfänger beziehungsweise Kategorien von Empfängern sowie die Rechte betroffener Personen ergeben sich aus der gesonderten Datenschutzinformation zur Videoüberwachung.',
      '3. Bereiche besonderer Privat- und Intimsphäre, insbesondere Umkleide-, Dusch- und Sanitärräume, werden nicht videoüberwacht.',
      '4. Betroffene Personen werden vor Betreten eines überwachten Bereichs in geeigneter Weise auf die Videoüberwachung hingewiesen. Weitergehende Informationen werden entsprechend den gesetzlichen Transparenzpflichten bereitgestellt.',
      '5. Einrichtung, Ausrichtung, Betriebszeit und Speicherdauer der Kameras sind auf das für den jeweiligen zulässigen Zweck erforderliche Maß zu beschränken. Gesetzliche Datenschutzrechte bleiben unberührt.',
    ],
  },
  {
    title: '§ 24 Datenschutz',
    paragraphs: [
      '1. Personenbezogene Daten werden nach den geltenden datenschutzrechtlichen Vorschriften verarbeitet.',
      '2. Weitere Informationen ergeben sich aus der gesonderten Datenschutzerklärung. Für eine Videoüberwachung werden ergänzende Datenschutzinformationen bereitgestellt.',
      '3. Hinweise zu Cookies und zur Änderung der Auswahl stehen in der Datenschutzerklärung und über den Link Cookies im Footer der Website.',
    ],
  },
  {
    title: '§ 25 Änderungen persönlicher Daten',
    paragraphs: [
      'Das Mitglied ist verpflichtet, Änderungen der für die Vertragsdurchführung erforderlichen Kontaktdaten, insbesondere Name, Anschrift, E-Mail-Adresse und gegebenenfalls Bankverbindung, zeitnah mitzuteilen.',
    ],
  },
  {
    title: '§ 26 Widerrufsrecht bei Fernabsatz und außerhalb von Geschäftsräumen geschlossenen Verträgen',
    paragraphs: [
      '1. Wird der Mitgliedschaftsvertrag ausschließlich unter Verwendung von Fernkommunikationsmitteln, beispielsweise online oder per E-Mail, oder außerhalb der Geschäftsräume geschlossen, können dem Mitglied die gesetzlichen Widerrufsrechte zustehen.',
      '2. Soweit ein Widerrufsrecht besteht, erhält das Mitglied eine gesonderte Widerrufsbelehrung einschließlich des gesetzlich vorgesehenen Muster-Widerrufsformulars.',
      '3. Soll auf ausdrücklichen Wunsch des Mitglieds bereits während einer laufenden Widerrufsfrist mit der Leistung begonnen werden, gelten die hierfür einschlägigen gesetzlichen Vorschriften.',
    ],
  },
  {
    title: '§ 27 Hausordnung',
    paragraphs: [
      '1. Die Hausordnung der KONNI MMA GYM GbR ergänzt diese Allgemeinen Geschäftsbedingungen.',
      '2. Die Hausordnung kann insbesondere Regelungen zu Hygiene, Bekleidung, Schutzausrüstung, Trainingsabläufen, Sparring, Nutzung der Matten- und Trainingsflächen, Verhalten gegenüber anderen Personen sowie Sicherheitsmaßnahmen enthalten.',
      '3. Bei Widersprüchen zwischen Mitgliedsvertrag, diesen AGB und Hausordnung geht eine individuell im Mitgliedsvertrag getroffene Vereinbarung vor. Zwingende gesetzliche Vorschriften bleiben unberührt.',
    ],
  },
  {
    title: '§ 28 Schlussbestimmungen',
    paragraphs: [
      '1. Es gilt das Recht der Bundesrepublik Deutschland unter Beachtung zwingender Verbraucherschutzvorschriften.',
      '2. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen davon grundsätzlich unberührt. An die Stelle der unwirksamen Regelung treten die gesetzlichen Vorschriften.',
      '3. Änderungen oder Ergänzungen individueller Vertragsvereinbarungen können im gegenseitigen Einvernehmen der Vertragsparteien vorgenommen werden.',
      `Stand: ${GYM.agbStand}.`,
    ],
  },
]

export const WITHDRAWAL = {
  stand: '27. September 2026',
  provider: [
    'KONNI MMA GYM GbR',
    'vertreten durch die Gesellschafter Konrad Dyrschka und Mehmet-Deniz Celik',
    'Wittenberger Straße 15',
    '04129 Leipzig',
    'E-Mail: info@mma-in-leipzig.de',
  ],
  right: [
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
    'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
    'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns',
    'KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig, E-Mail: info@mma-in-leipzig.de',
    'mittels einer eindeutigen Erklärung, zum Beispiel durch einen mit der Post versandten Brief oder eine E-Mail, über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.',
    'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
  ],
  effects: [
    'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.',
    'Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Zahlung eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart. In keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
    'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen. Dieser entspricht dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns über die Ausübung des Widerrufsrechts unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen.',
  ],
  early: [
    'Diese Erklärung ist erforderlich, wenn Sie bereits vor Ablauf der 14-tägigen Widerrufsfrist mit dem Training beziehungsweise der Nutzung der vertraglich vereinbarten Leistungen beginnen möchten.',
    'Ich verlange ausdrücklich, dass die KONNI MMA GYM GbR bereits vor Ablauf der gesetzlichen Widerrufsfrist mit der Erbringung der vertraglich vereinbarten Dienstleistungen beginnt.',
    'Mir ist bekannt, dass ich bei Ausübung meines Widerrufsrechts für die bis zum Widerruf bereits erbrachten Dienstleistungen einen angemessenen Betrag zu zahlen habe, sofern die gesetzlichen Voraussetzungen für den Wertersatz vorliegen.',
  ],
  formLead: 'Wenn Sie den Vertrag widerrufen wollen, können Sie dieses Formular ausfüllen und zurücksenden.',
  form: [
    'An: KONNI MMA GYM GbR, Wittenberger Straße 15, 04129 Leipzig, E-Mail: info@mma-in-leipzig.de',
    'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:',
    'Mitgliedschaft / Dienstleistung: ______________________________',
    'Vertrag abgeschlossen am: ______________________________',
    'Name des/der Verbraucher(s): ______________________________',
    'Anschrift des/der Verbraucher(s): ______________________________',
    'Datum: ______________________________',
    'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________________________',
    '(*) Unzutreffendes streichen.',
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

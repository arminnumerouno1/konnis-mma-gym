import { COPY } from '../brand/copy'
import { GYM } from '../brand/gym'
import { AGB, CONTRACT_INTRO, COOKIE_TABLE, HOUSE_RULES, IMPRESSUM, ODR_URL, PRIVACY, WITHDRAWAL } from '../brand/legal'
import { CookieStatus } from '../components/CookieBanner'
import { Link } from '../lib/Link'
import { href, type RouteName } from '../lib/router'

type LegalProps = {
  name: Extract<RouteName, 'impressum' | 'datenschutz' | 'agb' | 'widerruf' | 'hausordnung' | 'vertrag12' | 'vertrag24'>
}

function Blocks({ blocks }: { blocks: { title: string; paragraphs: string[] }[] }) {
  return (
    <div className="legal-blocks">
      {blocks.map((block) => (
        <section key={block.title}>
          {block.title !== 'Kopf' ? <h2>{block.title}</h2> : null}
          {block.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {block.title.startsWith('3. Cookies') ? <CookieTable /> : null}
        </section>
      ))}
    </div>
  )
}

function CookieTable() {
  return (
    <div className="cookie-table-wrap">
      <table className="cookie-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Art</th>
            <th>Speicher</th>
            <th>Laufzeit</th>
            <th>Zweck</th>
          </tr>
        </thead>
        <tbody>
          {COOKIE_TABLE.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.kind}</td>
              <td>{row.place}</td>
              <td>{row.time}</td>
              <td>{row.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Legal({ name }: LegalProps) {
  return (
    <main className="page legal-page">
      <p className="kicker">KONNI MMA GYM · Leipzig</p>
      {name === 'impressum' ? <Impressum /> : null}
      {name === 'datenschutz' ? (
        <>
          <h1>{COPY.privacy}</h1>
          <p>Stand: {GYM.agbStand}</p>
          <CookieStatus />
          <Blocks blocks={PRIVACY} />
        </>
      ) : null}
      {name === 'agb' ? (
        <>
          <h1>{COPY.agb}</h1>
          <p>Stand: {GYM.agbStand}</p>
          <Blocks blocks={AGB} />
        </>
      ) : null}
      {name === 'widerruf' ? <Withdrawal /> : null}
      {name === 'hausordnung' ? (
        <>
          <h1>{COPY.house}</h1>
          <Blocks blocks={HOUSE_RULES} />
        </>
      ) : null}
      {name === 'vertrag12' ? <Contract months={12} /> : null}
      {name === 'vertrag24' ? <Contract months={24} /> : null}
      <p className="legal-back">
        <Link href="/">Zur Startseite</Link>
        {' · '}
        <Link href={href('join')}>{COPY.ctaJoin}</Link>
      </p>
    </main>
  )
}

function Impressum() {
  return (
    <>
      <p className="kicker">{IMPRESSUM.eyebrow}</p>
      <h1>{IMPRESSUM.title}</h1>
      <dl className="imprint">
        {IMPRESSUM.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.label === 'E-Mail' || row.label === 'E-Mail (Verträge)' ? (
                <a href={`mailto:${row.value}`}>{row.value}</a>
              ) : row.label === 'Telefon' ? (
                <a href={GYM.phoneHref}>{row.value}</a>
              ) : row.label === 'WhatsApp' ? (
                <a href={GYM.whatsapp} target="_blank" rel="noreferrer">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {IMPRESSUM.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {IMPRESSUM.blocks.map((block) => (
        <section key={block.title}>
          <h2>{block.title}</h2>
          {block.paragraphs.map((p) =>
            p.startsWith('OS-Plattform:') ? (
              <p key={p}>
                OS-Plattform:{' '}
                <a href={ODR_URL} target="_blank" rel="noreferrer">
                  {ODR_URL}
                </a>
              </p>
            ) : (
              <p key={p}>{p}</p>
            ),
          )}
        </section>
      ))}
    </>
  )
}

function Withdrawal() {
  return (
    <>
      <h1>Widerrufsbelehrung</h1>
      <p>Stand: {WITHDRAWAL.stand}</p>
      {WITHDRAWAL.provider.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p>
        <a className="btn btn-ghost" href="/legal/widerrufsbelehrung.pdf">
          {COPY.withdrawPdf}
        </a>
      </p>
      <h2>Widerrufsrecht</h2>
      {WITHDRAWAL.right.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Folgen des Widerrufs</h2>
      {WITHDRAWAL.effects.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Erklärung zum Leistungsbeginn während der Widerrufsfrist</h2>
      {WITHDRAWAL.early.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Muster-Widerrufsformular</h2>
      <p>{WITHDRAWAL.formLead}</p>
      {WITHDRAWAL.form.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  )
}

function Contract({ months }: { months: 12 | 24 }) {
  return (
    <>
      <h1>Mitgliedsvertrag · {months} Monate</h1>
      <p>{CONTRACT_INTRO[String(months) as '12' | '24']}</p>
      <h2>1. Vertragsparteien</h2>
      <p>
        Anbieter: {GYM.legalName}, vertreten durch {GYM.partners.join(' und ')}, {GYM.street}, {GYM.zip} {GYM.city}.
        E-Mail für Kündigungen: {GYM.legalEmail}.
      </p>
      <p>Mitglied: Vor- und Nachname, Geburtsdatum, Anschrift, E-Mail / Telefon — im Online-Formular.</p>
      <h2>2. Leistungen, Beginn und Preis</h2>
      <p>
        Nutzung der Trainings und Flächen ab Beginn des regulären Betriebs zu den veröffentlichten Zeiten. Der
        Kursplan kann sich ändern, der wesentliche Charakter bleibt.
      </p>
      <p>
        Die Zahlungspflicht beginnt erst mit der tatsächlichen Eröffnung. Verschiebt sich die Eröffnung um mehr als
        acht Wochen über den geplanten Termin, kannst du vor Leistungsbeginn in Textform zurücktreten. Schon
        gezahlte Beträge werden erstattet.
      </p>
      <p>
        Die Monatsbeiträge werden per SEPA-Lastschrift eingezogen. Fälligkeit ist der 1. des Monats. Fällt der 1.
        auf ein Wochenende oder einen Feiertag, gilt der nächste Bankarbeitstag. Der erste angebrochene Monat wird
        anteilig berechnet. Aufnahmegebühr: 0 €, fällig mit Beginn der Zahlungspflicht.
      </p>
      <p>
        Du erteilst uns ein SEPA-Lastschriftmandat. Gläubiger-Identifikationsnummer und Mandatsreferenz teilen wir
        vor dem ersten Einzug mit. Das Konto muss am Abbuchungstag gedeckt sein. Rücklastschriftkosten, die du zu
        vertreten hast, können in tatsächlich entstandener Höhe berechnet werden.
      </p>
      <h2>3. Laufzeit und Kündigung</h2>
      <p>
        Anfängliche Vertragsdauer: {months} Monate ab Vertragsschluss. Beginnt das Training später, bleibt das
        vertragliche Ende gleich; vorher fallen keine Monatsbeiträge an. Ordentliche Kündigung mit einem Monat zum
        Ende dieser Erstlaufzeit. Ohne Kündigung läuft der Vertrag unbefristet weiter und ist dann jederzeit mit
        einem Monat kündbar. Kündigung in Textform an {GYM.legalEmail}. Außerordentliche Kündigung bleibt.
      </p>
      <h2>4.–6. Training, Gesundheit, Minderjährige</h2>
      <p>
        Hausordnung gilt. Eigenverantwortliche Gesundheitsprüfung. Haftung nach Gesetz. Minderjährige brauchen die
        Zustimmung aller erforderlichen gesetzlichen Vertreter. AGB Stand {GYM.agbDate} und Hausordnung sind Teil
        des Vertrags.
      </p>
      <p>
        Online schließt du denselben Inhalt über <Link href={href('join')}>das Anmeldeformular</Link> ab.
      </p>
    </>
  )
}

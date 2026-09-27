import { COPY } from '../brand/copy'
import { GYM } from '../brand/gym'
import { AGB, CONTRACT_INTRO, HOUSE_RULES, IMPRESSUM, PRIVACY, WITHDRAWAL } from '../brand/legal'
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
        </section>
      ))}
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
          <Blocks blocks={PRIVACY} />
        </>
      ) : null}
      {name === 'agb' ? (
        <>
          <h1>{COPY.agb}</h1>
          <p>
            Original:{' '}
            <a href="/legal/agb.pdf">AGB als PDF</a>
          </p>
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
              {row.label === 'Kontakt' || row.label === 'E-Mail (Verträge)' ? (
                <a href={`mailto:${row.value}`}>{row.value}</a>
              ) : row.label === 'Telefon' ? (
                <a href={GYM.phoneHref}>{row.value}</a>
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
    </>
  )
}

function Withdrawal() {
  return (
    <>
      <h1>Widerrufsbelehrung</h1>
      <p>
        Original: <a href="/legal/widerrufsbelehrung.pdf">Widerruf als PDF</a>
      </p>
      <h2>Widerrufsrecht</h2>
      {WITHDRAWAL.right.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Folgen des Widerrufs</h2>
      {WITHDRAWAL.effects.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Bereits in Anspruch genommene Leistungen</h2>
      {WITHDRAWAL.used.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Erklärung zum vorzeitigen Leistungsbeginn</h2>
      {WITHDRAWAL.early.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <h2>Muster-Widerrufsformular</h2>
      {WITHDRAWAL.form.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  )
}

function Contract({ months }: { months: 12 | 24 }) {
  const pdf = months === 12 ? '/legal/mitgliedsvertrag-12-monate.pdf' : '/legal/mitgliedsvertrag-24-monate.pdf'
  return (
    <>
      <h1>Mitgliedsvertrag · {months} Monate</h1>
      <p>{CONTRACT_INTRO[String(months) as '12' | '24']}</p>
      <p>
        Original: <a href={pdf}>Vertrag als PDF</a>
      </p>
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
        Du überweist den Monatsbeitrag so, dass er spätestens am 1. da ist. Fällt der 1. auf ein Wochenende oder
        einen Feiertag, gilt der nächste Bankarbeitstag. Der erste angebrochene Monat wird anteilig berechnet.
        Aufnahmegebühr: 0 €, fällig mit Beginn der Zahlungspflicht.
      </p>
      <p>Konto teilen wir vor der Eröffnung mit. Verwendungszweck: Mitgliedsbeitrag / dein Name.</p>
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

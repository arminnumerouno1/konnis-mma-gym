import { COPY } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { Link } from '../lib/Link'
import { href } from '../lib/router'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <img src={GYM.logo} alt="" width={88} height={94} />
        <p className="footer-tag">{COPY.footerTag}</p>
      </div>
      <div className="footer-grid">
        <div>
          <p className="footer-kicker">{GYM.legalName}</p>
          <p>
            {GYM.partners.join(' · ')}
            <br />
            {GYM_ADDRESS}
            <br />
            <a href={`mailto:${GYM.email}`}>{GYM.email}</a>
          </p>
        </div>
        <div>
          <p className="footer-kicker">{COPY.legalNav}</p>
          <ul>
            <li>
              <Link href={href('impressum')}>{COPY.impressum}</Link>
            </li>
            <li>
              <Link href={href('datenschutz')}>{COPY.privacy}</Link>
            </li>
            <li>
              <Link href={href('agb')}>{COPY.agb}</Link>
            </li>
            <li>
              <Link href={href('widerruf')}>{COPY.withdraw}</Link>
            </li>
            <li>
              <Link href={href('hausordnung')}>{COPY.house}</Link>
            </li>
            <li>
              <Link href={href('vertrag12')}>{COPY.contract12}</Link>
            </li>
            <li>
              <Link href={href('vertrag24')}>{COPY.contract24}</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="footer-kicker">Verträge</p>
          <ul>
            <li>
              <a href="/legal/agb.pdf">AGB PDF</a>
            </li>
            <li>
              <a href="/legal/widerrufsbelehrung.pdf">Widerruf PDF</a>
            </li>
            <li>
              <a href="/legal/mitgliedsvertrag-12-monate.pdf">Vertrag 12 Monate PDF</a>
            </li>
            <li>
              <a href="/legal/mitgliedsvertrag-24-monate.pdf">Vertrag 24 Monate PDF</a>
            </li>
          </ul>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} {GYM.legalName}</p>
    </footer>
  )
}

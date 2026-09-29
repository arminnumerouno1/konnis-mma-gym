import { COPY } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { openConsentSettings } from '../lib/consent'
import { Link } from '../lib/Link'
import { href } from '../lib/router'
import { InstagramIcon } from './InstagramIcon'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <img src={GYM.logo} alt="" width={72} height={76} />
          <p className="footer-tag">{COPY.footerTag}</p>
        </div>
        <a className="footer-ig" href={GYM.instagram} target="_blank" rel="noreferrer">
          <InstagramIcon />
          <span>{COPY.footerFollow}</span>
        </a>
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
            <br />
            <a href={GYM.phoneHref}>{GYM.phone}</a>
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
              <button className="footer-text-btn" type="button" onClick={() => openConsentSettings()}>
                {COPY.footerCookies}
              </button>
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
          <p className="footer-kicker">{COPY.legalDownload}</p>
          <ul>
            <li>
              <a href="/legal/widerrufsbelehrung.pdf">{COPY.withdrawPdf}</a>
            </li>
          </ul>
        </div>
      </div>
      <p className="footer-copy">
        © {new Date().getFullYear()} {GYM.legalName}
      </p>
    </footer>
  )
}

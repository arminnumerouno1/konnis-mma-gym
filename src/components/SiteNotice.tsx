import { COPY } from '../brand/copy'

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function isSiteNoticeActive(today = berlinToday()) {
  return today <= COPY.siteNoticeUntil
}

export function SiteNotice() {
  if (!isSiteNoticeActive()) return null

  return (
    <aside className="site-notice" role="status">
      <p className="site-notice-kicker">{COPY.siteNoticeKicker}</p>
      <p className="site-notice-title">{COPY.siteNoticeTitle}</p>
      <p className="site-notice-lead">{COPY.siteNoticeLead}</p>
    </aside>
  )
}

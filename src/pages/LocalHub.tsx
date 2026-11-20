import { useEffect } from 'react'
import { COPY } from '../brand/copy'
import { GYM, GYM_ADDRESS } from '../brand/gym'
import { KONRAD } from '../brand/konrad'
import { LOCAL_HUBS, type LocalHubId } from '../brand/localSeo'
import { GOOGLE_REVIEWS } from '../brand/reviews'
import { CANONICAL_ORIGIN } from '../brand/seo'
import { Link } from '../lib/Link'
import { applyPageMeta } from '../lib/pageMeta'
import { href } from '../lib/router'

type Props = { hub: LocalHubId }

export function LocalHub({ hub }: Props) {
  const page = LOCAL_HUBS[hub]

  useEffect(() => {
    applyPageMeta({
      title: page.title,
      description: page.description,
      path: page.path,
    })

    const faqLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    }
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'KONNI MMA GYM',
          item: `${CANONICAL_ORIGIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.h1,
          item: `${CANONICAL_ORIGIN}${page.path}`,
        },
      ],
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'local-hub-jsonld'
    script.text = JSON.stringify([faqLd, breadcrumbLd])
    document.getElementById('local-hub-jsonld')?.remove()
    document.head.appendChild(script)

    return () => {
      document.getElementById('local-hub-jsonld')?.remove()
    }
  }, [page])

  return (
    <main className={`hub-page hub-${hub}`}>
      <header className="hub-hero">
        <div className="hub-hero-copy">
          <p className="hub-stamp">{page.stamp}</p>
          <h1>
            <span className="hub-h1-main">{page.h1}</span>
            <span className="hub-h1-hit">{page.hit}</span>
          </h1>
          {page.lead.map((para) => (
            <p key={para.slice(0, 48)} className="hub-lead">
              {para}
            </p>
          ))}
          <div className="hub-cta">
            <Link className="btn btn-solid" href={href('join')}>
              {COPY.ctaJoinNow}
            </Link>
            <Link className="btn btn-ghost" href={`${href('home')}#kursplan`}>
              {COPY.navPlan}
            </Link>
          </div>
        </div>
        <div className="hub-hero-media">
          <img src={page.heroImage} alt={page.heroAlt} width={1600} height={1200} loading="eager" />
        </div>
      </header>

      <section className="hub-story">
        <h2>{page.storyTitle}</h2>
        {page.story.map((para) => (
          <p key={para.slice(0, 40)}>{para}</p>
        ))}
      </section>

      {page.coachTitle && page.coachParas ? (
        <section className="hub-konrad-band">
          <img
            src={GYM.konradCage}
            alt={`${KONRAD.fullName} im Cage`}
            width={900}
            height={1200}
            loading="lazy"
          />
          <div>
            <p className="hub-stamp">Head Coach</p>
            <h2>{page.coachTitle}</h2>
            {page.coachParas.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
            <Link className="btn btn-ghost" href={`${href('home')}#konrad-dyrschka`}>
              Mehr zu Konrad
            </Link>
          </div>
        </section>
      ) : null}

      <section className={`hub-beats${hub === 'kampfsportLeipzig' ? ' hub-beats-disciplines' : ''}`}>
        {page.beats.map((beat) => (
          <article key={beat.title}>
            <h3>{beat.title}</h3>
            <p>{beat.text}</p>
          </article>
        ))}
      </section>

      <section className="hub-week">
        <div>
          <h2>{page.scheduleNote}</h2>
          <ul>
            {page.schedule.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <Link href={`${href('home')}#kursplan`}>Zum Kursplan</Link>
        </div>
        <div className="hub-week-aside">
          <p className="hub-stamp">{page.weekAsideStamp}</p>
          <h3>{page.weekAsideTitle}</h3>
          {page.weekAsideParas.map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      </section>

      <section className="hub-voice">
        <div className="hub-voice-head">
          <h2>{page.voiceTitle}</h2>
          <p>
            <strong>{GOOGLE_REVIEWS.ratingLabel}</strong> auf Google · {GOOGLE_REVIEWS.countLabel}
          </p>
        </div>
        <blockquote className="hub-quote">
          <p>{GOOGLE_REVIEWS.quotes[0].text}</p>
          <footer>
            — {GOOGLE_REVIEWS.quotes[0].name}, Google
          </footer>
        </blockquote>
        <a href={GYM.googleReviews} target="_blank" rel="noopener noreferrer">
          {COPY.reviewsReadAll}
        </a>
      </section>

      <section className="hub-place">
        <h2>{page.placeTitle}</h2>
        {page.place.map((para) => (
          <p key={para.slice(0, 40)}>{para}</p>
        ))}
        <p className="hub-place-names">Ortsteile und Umland: {page.placeNames}.</p>
      </section>

      <section className="hub-faq">
        <h2>{COPY.faqTitle}</h2>
        <div className="faq-list">
          {page.faqs.map((item) => (
            <div className="faq-item" key={item.q}>
              <details>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            </div>
          ))}
        </div>
      </section>

      <section className="hub-close">
        <h2>{page.closeTitle}</h2>
        <p>{page.close}</p>
        <div className="hub-cta">
          <Link className="btn btn-solid" href={href('join')}>
            {COPY.ctaJoin}
          </Link>
          {page.related.map((item) => (
            <Link key={item.id} className="btn btn-ghost" href={href(item.id)}>
              {item.label}
            </Link>
          ))}
        </div>
        <p className="hub-close-meta">
          {GYM.name} · {GYM_ADDRESS}
          <br />
          <a href={`mailto:${GYM.email}`}>{GYM.email}</a>
          {' · '}
          <a href={GYM.phoneHref}>{GYM.phone}</a>
        </p>
      </section>
    </main>
  )
}

/** Kuratierte Google-Rezensionen — nur Links zu Google, kein Embed/Widget. */

export type GoogleReview = {
  name: string
  text: string
  rating: 5
  source: 'Google'
}

export const GOOGLE_REVIEWS = {
  /** Öffentliches Google-Unternehmensprofil (Share-Link). */
  profileUrl: 'https://share.google/00Lw4PnXTlsVnnkKO',
  /** Knowledge-Graph / Rezensionsansicht. */
  reviewsUrl:
    'https://www.google.com/search?q=KONNI+MMA+GYM+Leipzig&kgmid=/g/11zy1q9d8k',
  rating: 5,
  ratingLabel: '5,0',
  count: 169,
  countLabel: '169 Rezensionen',
  quotes: [
    {
      name: 'Lars Bindheim',
      rating: 5,
      source: 'Google',
      text: 'Top Trainer mit enorm viel Erfahrung und Fachwissen. Man merkt sofort, dass hier Leidenschaft und Professionalität dahinterstecken. Absolut empfehlenswert!',
    },
    {
      name: 'Finn',
      rating: 5,
      source: 'Google',
      text: 'Sehr gutes Gym mit angenehmer Atmosphäre und einer starken Community. Das Training ist professionell gestaltet und macht richtig Spaß.',
    },
    {
      name: 'Lea-Sophie Kurth',
      rating: 5,
      source: 'Google',
      text: 'Ein super Kampfsportstudio mit ganz lieben Leuten – man merkt, wie viel Leidenschaft reingesteckt wurde. Eine klare Empfehlung!',
    },
  ] as const satisfies readonly GoogleReview[],
} as const

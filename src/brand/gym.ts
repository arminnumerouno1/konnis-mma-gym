export const GYM = {
  name: 'KONNI MMA GYM',
  legalName: 'KONNIMMAGYM GbR',
  short: 'KONNI',
  city: 'Leipzig',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  country: 'Deutschland',
  email: 'info@mma-in-leipzig.de',
  legalEmail: 'info@mma-in-leipzig.de',
  phone: '+49 1522 1872354',
  phoneHref: 'tel:+4915221872354',
  whatsapp: 'https://wa.me/4915221872354',
  instagram: 'https://www.instagram.com/konnimmagym/',
  instagramHandle: '@konnimmagym',
  partners: ['Konrad Dyrschka', 'Mehmet-Deniz Celik'] as const,
  agbStand: 'September 2026',
  agbDate: '26.09.2026',
  mapsUrl:
    'https://www.openstreetmap.org/search?query=Wittenberger%20Stra%C3%9Fe%2015%2C%2004129%20Leipzig',
  logo: '/brand/konni-logo-ui.webp',
  konrad: '/brand/konrad.png',
  mehmet: '/brand/mehmet.png',
  hours: [
    { days: 'Montag–Freitag', time: '15:30–21:30' },
    { days: 'Samstag', time: '10:00–14:00' },
    { days: 'Sonntag', time: 'geschlossen' },
  ],
  hoursNote: 'Geplante Zeiten zum Start. Kann sich noch verschieben.',
} as const

export const GYM_ADDRESS = `${GYM.street}, ${GYM.zip} ${GYM.city}`

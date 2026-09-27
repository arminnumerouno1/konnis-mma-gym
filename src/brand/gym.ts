export const GYM = {
  name: 'KONNI MMA GYM',
  legalName: 'KONNI MMA GYM GbR',
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
  agbStand: '27. September 2026',
  agbDate: '27.09.2026',
  mapsUrl:
    'https://www.openstreetmap.org/search?query=Wittenberger%20Stra%C3%9Fe%2015%2C%2004129%20Leipzig',
  mapsEmbed:
    'https://www.openstreetmap.org/export/embed.html?bbox=12.3846%2C51.3564%2C12.3886%2C51.3585&layer=mapnik&marker=51.3574773%2C12.3866214',
  logo: '/brand/konni-logo-ui.webp',
  konrad: '/brand/konrad.png',
  mehmet: '/brand/mehmet.png',
  hall: {
    cage: '/brand/halle/cage.jpg',
    floor: '/brand/halle/floor.jpg',
    depth: '/brand/halle/depth.jpg',
    marks: '/brand/halle/marks.jpg',
    ropes: '/brand/halle/ropes.jpg',
  },
  hours: [
    { days: 'Montag–Freitag', time: '15:30–21:30' },
    { days: 'Samstag', time: '10:00–14:00' },
    { days: 'Sonntag', time: 'geschlossen' },
  ],
  hoursNote: 'Geplante Zeiten zum Start. Kann sich noch verschieben.',
} as const

export const GYM_ADDRESS = `${GYM.street}, ${GYM.zip} ${GYM.city}`

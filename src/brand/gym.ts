export const GYM = {
  name: 'KONNI MMA GYM',
  legalName: 'KONNIMMAGYM GbR',
  short: 'KONNI',
  city: 'Leipzig',
  street: 'Wittenberger Straße 15',
  zip: '04129',
  country: 'Deutschland',
  email: 'konni.mmagym@gmail.com',
  partners: ['Konrad Dyrschka', 'Mehmet-Deniz Celik'] as const,
  agbStand: 'September 2026',
  agbDate: '26.09.2026',
  mapsUrl:
    'https://www.openstreetmap.org/search?query=Wittenberger%20Stra%C3%9Fe%2015%2C%2004129%20Leipzig',
  logo: '/brand/konni-logo-ui.webp',
  konrad: '/brand/konrad.png',
} as const

export const GYM_ADDRESS = `${GYM.street}, ${GYM.zip} ${GYM.city}`

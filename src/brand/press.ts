export type PressArticle = {
  outlet: string
  logo: string
  logoAlt: string
  title: string
  line: string
  href: string
}

/** Externe Presse über Konrad — nur Links, kein Volltext (Urheberrecht). LVZ steht in der Mitte. */
export const PRESS: PressArticle[] = [
  {
    outlet: 'BILD',
    logo: '/brand/press/bild.png',
    logoAlt: 'BILD',
    title: '„Ich bin der Gladiator aus Leipzig“',
    line: 'Große Ziele in der Leichtgewichtsdivision.',
    href: 'https://www.bild.de/sport/mehr-sport/sport-mix/mma-konrad-dyrschka-hat-grosse-ziele-ich-bin-der-gladiator-aus-leipzig-78388078.bild.html',
  },
  {
    outlet: 'LVZ',
    logo: '/brand/press/lvz.png',
    logoAlt: 'LVZ · Leipziger Volkszeitung',
    title: 'Leben als Profikämpfer',
    line: 'Trotz Verletzungen immer wieder in den Ring.',
    href: 'https://www.lvz.de/sport/regional/extremsport-mixed-martial-arts-leipziger-konrad-dyrschka-ueber-sein-leben-als-profikaempfer-3ZVFAQ7KCFGSBJ56YGSR3WDKO4.html',
  },
  {
    outlet: 'BILD',
    logo: '/brand/press/bild.png',
    logoAlt: 'BILD',
    title: 'Zurück im Käfig',
    line: 'Comeback nach dem Horror-Unfall.',
    href: 'https://www.bild.de/sport/mehr-sport/sport-mix/mma-konrad-dyrschka-nach-horror-unfall-zurueck-im-kaefig-86044206.bild.html',
  },
]

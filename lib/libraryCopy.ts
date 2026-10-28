// Names and stories of the curated Design Library pieces, in every UI
// language. Kept out of lib/i18n.tsx (a React module) so the contact-sheet
// renderer and the library tests can read them in plain Node; i18n.tsx mounts
// these under `library.items.<id>` exactly as before.

export type ItemCopy = { n: string; d: string };

export const LIBRARY_ITEMS: { en: Record<string, ItemCopy>; cs: Record<string, ItemCopy> } = {
  en: {
    staggered: { n: "Staggered bookcase", d: "Offset shelves and one tall nook for the things that never fit a straight row." },
    catbench: { n: "Cat box bench", d: "A bench with an open bay for the litter box and a storage shelf next to it. Cushion goes on top." },
    record: { n: "Record sideboard", d: "Low sideboard with slots sized for LPs and room for the player on top." },
    police: { n: "Alcove classic", d: "Three shelves, 73 cm wide. The alcove piece Myble started with." },
    coffee: { n: "Coffee table", d: "A low top with a magazine shelf underneath. Coffee above, clutter below." },
    grid: { n: "Grid bookcase", d: "A calm two-column grid that holds a lot without looking like it." },
    nightstand: { n: "Nightstand", d: "An open tray for the book and phone, a taller bay below for the rest." },
    tvbench: { n: "TV bench", d: "Long and low, with compartments for the box, the console and the cables." },
    skrinka: { n: "Slim cabinet", d: "Four shelves and a centre divider. Maximum storage on a 60 cm footprint." },
    shoebench: { n: "Shoe bench", d: "Three open bays by the door. Sit down, lace up, go." },
    worknook: { n: "Work nook", d: "A desk surface with shelving above and below. A home office in one footprint." },
    stolek: { n: "Side table", d: "Bedside or sofa-side, with one shelf in between." },
  },
  cs: {
    staggered: { n: "Knihovna na přeskáčku", d: "Police s přesahy a jedno vyšší okénko na věci, které se do rovné řady nevejdou." },
    catbench: { n: "Lavice pro kočku", d: "Lavice s otevřeným boxem na kočičí toaletu a policí na všechno ostatní. Nahoru stačí polštář." },
    record: { n: "Komoda na vinyly", d: "Nízká komoda s přihrádkami na desky a místem pro gramofon nahoře." },
    police: { n: "Klasika do niky", d: "Tři police, šířka 73 cm. Kus, kterým Myble začalo." },
    coffee: { n: "Konferenční stolek", d: "Nízká deska s poličkou na časopisy. Káva nahoře, nepořádek dole." },
    grid: { n: "Kubická knihovna", d: "Klidný rastr dvou sloupců, který pojme víc, než na sobě dá znát." },
    nightstand: { n: "Noční stolek", d: "Otevřená přihrádka na knížku a telefon, větší prostor dole na zbytek." },
    tvbench: { n: "TV lavice", d: "Dlouhá a nízká, s přihrádkami na set-top box, konzoli i kabely." },
    skrinka: { n: "Úzká skříňka", d: "Čtyři police a středová příčka. Maximum úložného prostoru na 60 cm." },
    shoebench: { n: "Botník", d: "Tři otevřené přihrádky u dveří. Sednout, zavázat, vyrazit." },
    worknook: { n: "Pracovní kout", d: "Pracovní deska s policemi nahoře i dole. Domácí kancelář na jedné stopě." },
    stolek: { n: "Odkládací stolek", d: "K posteli nebo k pohovce, s jednou policí uvnitř." },
  },
};

// Names and stories of the curated Design Library pieces, in every UI
// language. Kept out of lib/i18n.tsx (a React module) so the contact-sheet
// renderer and the library tests can read them in plain Node; i18n.tsx mounts
// these under `library.items.<id>` exactly as before.
//
// Voice (brand guidelines §5): problem first, concrete, numbers that are true,
// short sentences, no exclamation marks, no superlatives.

export type ItemCopy = { n: string; d: string };

export const LIBRARY_ITEMS: { en: Record<string, ItemCopy>; cs: Record<string, ItemCopy> } = {
  en: {
    police: { n: "Alcove classic", d: "Three shelves at 68 cm, as wide as 18 mm board spans without sagging under books. Rails at the back keep it square. Set it to your alcove; past 68 cm it takes a divider." },
    grid: { n: "Grid bookcase", d: "Two columns, four rows, every cubby 27 cm tall so hardbacks stand upright. Rails at the back keep it square." },
    stolek: { n: "Two-tier nightstand", d: "A shallow tray under the top for the phone and glasses, a 32 cm bay below for the books you mean to read." },
    tvbench: { n: "TV bench", d: "Long and low, with compartments for the box, the console and the cables." },
    record: { n: "Record console", d: "Four slots below, 34 cm tall and 38 deep, sized for LPs. A 49 cm bay above for the amplifier, the turntable on top at 62 cm." },
    shoebench: { n: "Shoe bench", d: "Sit down, lace up, go. Two bays with a shelf for everyday shoes, one full-height bay for boots." },
    catbench: { n: "Cat box bench", d: "The litter tray hides behind a front panel that stops 20 cm above the floor: the cat walks in underneath and the tray slides out the same way. Litter and the scoop live next door, a cushion goes on top." },
  },
  cs: {
    police: { n: "Klasika do niky", d: "Tři police široké 68 cm, tolik unese 18mm deska s knihami bez prohnutí. Lišty vzadu ji drží v pravém úhlu. Nastavte ji na svou niku; nad 68 cm přidejte příčku." },
    grid: { n: "Kubická knihovna", d: "Dva sloupce, čtyři řady a každé okno 27 cm vysoké, takže se vejdou i knihy v pevné vazbě. Lišty vzadu ji drží v pravém úhlu." },
    stolek: { n: "Noční stolek se dvěma patry", d: "Pod deskou nízká přihrádka na telefon a brýle, dole 32 cm vysoký prostor na knihy, které chcete dočíst." },
    tvbench: { n: "TV lavice", d: "Dlouhá a nízká, s přihrádkami na set-top box, konzoli i kabely." },
    record: { n: "Komoda na vinyly", d: "Dole čtyři přihrádky 34 cm vysoké a 38 cm hluboké, přesně na desky LP. Nahoře 49 cm široký prostor pro zesilovač, gramofon na desce ve výšce 62 cm." },
    shoebench: { n: "Botník s lavicí", d: "Sednout, zavázat, vyrazit. Dvě přihrádky s policí na boty na každý den, jedna vysoká na kozačky." },
    catbench: { n: "Lavice pro kočku", d: "Toaleta se schová za čelní desku, která končí 20 cm nad zemí: kočka vejde pod ní a vanička se stejnou cestou vysune. Vedle místo na stelivo a lopatku, nahoru polštář." },
  },
};

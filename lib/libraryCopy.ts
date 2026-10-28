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
    offset: { n: "Offset bookcase", d: "Two columns, the right one's shelves halfway between the left one's, like the Myble mark. Every shelf is held at both ends by a full-height divider: 190 cm of books on 78 cm of wall." },
    slimtower: { n: "Slim tower", d: "40 cm wide, for the gap beside a door or the fridge. Two tall bays at the bottom for boxes, a 40 cm bay at eye height, three low ones at the top for paperbacks." },
    library: { n: "Three-bay library", d: "A wall of books, 118 by 180 cm, with a middle column twice as tall for the things that aren't books: the radio, a plant, a framed print." },
    underwindow: { n: "Under-window bookcase", d: "72 cm tall so it stays under the sill. Shelves either side, a tall open bay in the middle for the record player or a plant, and the top as a long window ledge." },
    divider: { n: "Checkerboard divider", d: "Splits a room at 96 cm without closing it off. Every outer cubby has a back on alternating sides, so it looks finished from both sides, and the middle column stays open like a window." },
    steps: { n: "Step shelf", d: "Three columns climbing to 40, 80 and 120 cm. Under the stairs, as a reading corner in a child's room, or as a staircase for plants." },
    windowseat: { n: "Window seat", d: "A bench at 47 cm with three cubbies for standard 33 cm storage boxes. It stands on its uprights, 10 cm off the floor, so it looks light and the vacuum gets under it." },
    toybox: { n: "Toy garage", d: "No bottom board, so toy bins slide straight out along the floor, even for a toddler. Books and favourites go on top, 52 cm high." },
    wardrobe: { n: "Open wardrobe", d: "For the alcove that should have been a wardrobe. Five shelves for folded clothes on the left, an 87 cm bay for the laundry basket on the right, 42 cm deep." },
    plantsteps: { n: "Plant steps", d: "Two steps for pots, at 36 and 72 cm, and four cubbies underneath for the watering can, soil and spare pots." },
  },
  cs: {
    police: { n: "Klasika do niky", d: "Tři police široké 68 cm, tolik unese 18mm deska s knihami bez prohnutí. Lišty vzadu ji drží v pravém úhlu. Nastavte ji na svou niku; nad 68 cm přidejte příčku." },
    grid: { n: "Kubická knihovna", d: "Dva sloupce, čtyři řady a každé okno 27 cm vysoké, takže se vejdou i knihy v pevné vazbě. Lišty vzadu ji drží v pravém úhlu." },
    stolek: { n: "Noční stolek se dvěma patry", d: "Pod deskou nízká přihrádka na telefon a brýle, dole 32 cm vysoký prostor na knihy, které chcete dočíst." },
    tvbench: { n: "TV lavice", d: "Dlouhá a nízká, s přihrádkami na set-top box, konzoli i kabely." },
    record: { n: "Komoda na vinyly", d: "Dole čtyři přihrádky 34 cm vysoké a 38 cm hluboké, přesně na desky LP. Nahoře 49 cm široký prostor pro zesilovač, gramofon na desce ve výšce 62 cm." },
    shoebench: { n: "Botník s lavicí", d: "Sednout, zavázat, vyrazit. Dvě přihrádky s policí na boty na každý den, jedna vysoká na kozačky." },
    catbench: { n: "Lavice pro kočku", d: "Toaleta se schová za čelní desku, která končí 20 cm nad zemí: kočka vejde pod ní a vanička se stejnou cestou vysune. Vedle místo na stelivo a lopatku, nahoru polštář." },
    offset: { n: "Přesazená knihovna", d: "Dva sloupce, police vpravo leží v polovině mezi policemi vlevo, jako ve značce Myble. Každou polici drží na obou koncích celovýšková příčka: 190 cm knih na 78 cm stěny." },
    slimtower: { n: "Úzká věž", d: "40 cm široká, do mezery vedle dveří nebo lednice. Dole dvě vysoké přihrádky na krabice, ve výšce očí 40cm okno, nahoře tři nízké na brožované knihy." },
    library: { n: "Trojdílná knihovna", d: "Stěna knih 118 × 180 cm s prostředním sloupcem o dvojnásobné výšce pro věci, které nejsou knihy: rádio, květinu, obraz." },
    underwindow: { n: "Knihovna pod okno", d: "72 cm vysoká, aby zůstala pod parapetem. Po stranách police, uprostřed vysoké otevřené pole na gramofon nebo květinu, nahoře dlouhá okenní deska." },
    divider: { n: "Šachovnicový dělicí regál", d: "Rozdělí místnost ve výšce 96 cm, aniž by ji uzavřel. Krajní přihrádky mají záda střídavě z jedné a z druhé strany, takže regál vypadá hotově z obou stran, a prostřední sloupec zůstává otevřený jako okno." },
    steps: { n: "Schodový regál", d: "Tři sloupce stoupají do výšky 40, 80 a 120 cm. Pod schody, jako čtecí koutek v dětském pokoji nebo jako schody pro květiny." },
    windowseat: { n: "Lavice pod okno", d: "Lavice ve výšce 47 cm se třemi přihrádkami na běžné 33cm úložné boxy. Stojí na bočnicích 10 cm nad podlahou, takže působí lehce a vysavač se dostane pod ni." },
    toybox: { n: "Garáž na hračky", d: "Bez spodní desky, takže boxy s hračkami vyjedou přímo po podlaze, zvládne to i batole. Knížky a oblíbené věci nahoře, ve výšce 52 cm." },
    wardrobe: { n: "Otevřená šatna", d: "Do niky, ze které měla být šatní skříň. Vlevo pět polic na složené oblečení, vpravo 87 cm vysoké místo na koš s prádlem, hloubka 42 cm." },
    plantsteps: { n: "Schody pro květiny", d: "Dva schody pro květináče ve výšce 36 a 72 cm a pod nimi čtyři přihrádky na konvičku, zeminu a náhradní květináče." },
  },
};

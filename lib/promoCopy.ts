// Copy for the promo ticker and the pages behind it (delivery, refer-a-friend,
// myble+), plus the checkout and account bits that make the offers usable.
//
// Kept out of lib/i18n.tsx on purpose: it is a lot of long-form text that only
// these surfaces read. Every number is interpolated from lib/promotions.ts and
// lib/pricingConfig.ts, so the copy cannot drift from the rules the server
// enforces. House rule: no em dashes in customer copy.

import type { Locale } from "./locale";
import { DELIVERY_CZK } from "./pricingConfig";
import {
  FREE_SHIP_CZK,
  LOYALTY_CZK_PER_POINT,
  LOYALTY_DESIGN_PUBLISHED_POINTS,
  REFERRAL_FRIEND_CZK,
  REFERRAL_REWARD_CZK,
  minKitFor,
} from "./promotions";

/** "5 000 Kč": Czech grouping, and a non-breaking space so a price never
 *  wraps between the number and the currency. */
export function czk(n: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(n)}\u00a0Kč`;
}

const n = (x: number) => new Intl.NumberFormat("cs-CZ").format(x);

export type Faq = { q: string; a: string; link?: { href: string; label: string } };

const FREE = czk(FREE_SHIP_CZK);
const FEE = czk(DELIVERY_CZK);
const FRIEND = czk(REFERRAL_FRIEND_CZK);
const REWARD = czk(REFERRAL_REWARD_CZK);
const FRIEND_MIN = czk(minKitFor(REFERRAL_FRIEND_CZK));
const REWARD_MIN = czk(minKitFor(REFERRAL_REWARD_CZK));

export function promoCopy(locale: Locale, opts: { libraryFrom: number }) {
  const LIB = czk(opts.libraryFrom);
  return locale === "cs" ? cs(LIB) : en(LIB);
}

export type PromoCopy = ReturnType<typeof cs>;

function cs(LIB: string) {
  return {
    bar: {
      label: "Výhody Myble",
      pause: "Pozastavit pás s výhodami",
      play: "Spustit pás s výhodami",
      delivery: `Doprava zdarma nad ${FREE}`,
      refer: `Dejte ${FRIEND}, získejte ${REWARD}`,
      plus: "myble+ věrnostní program",
      library: `Hotové návrhy od ${LIB}`,
    },

    delivery: {
      eyebrow: "Doprava a doručení",
      title: "Doručíme až k vašim dveřím.",
      body: "Každý kus vyrábíme podle vašich rozměrů a posíláme ho jako sadu k montáži kamkoli v České republice.",
      stats: [
        { v: FEE, l: "doprava za objednávku" },
        { v: "0 Kč", l: `když sada stojí ${FREE} a víc` },
        { v: "3–4 týdny", l: "obvykle od platby, vždy do 28 dnů" },
        { v: "2 zásilky", l: "desky zvlášť, kování zvlášť" },
      ],
      progressTitle: "Váš rozpracovaný návrh",
      progressRemaining: (gap: string) => `Do dopravy zdarma vám chybí ${gap}.`,
      progressDone: "Tenhle kus má dopravu zdarma.",
      progressCta: "Upravit návrh",
      progressEmpty: "Navrhněte si kus a uvidíte, kolik vám chybí do dopravy zdarma.",
      progressEmptyCta: "Otevřít konfigurátor",
      faqTitle: "Otázky k dopravě",
      faq: [
        {
          q: "Kolik stojí doprava?",
          a: `Doprava po celé ČR stojí ${FEE} za objednávku. Jakmile cena sady po případné slevě dosáhne ${FREE}, doprava je zdarma. Přesnou cenu dopravy vidíte v konfigurátoru i v pokladně ještě před odesláním objednávky.`,
        },
        {
          q: "Kdy mi objednávka dorazí?",
          a: "Vyrábět začínáme po potvrzení rozměrů a přijetí platby. Výroba obvykle trvá 10 až 15 pracovních dnů, potom následuje doprava. Většina objednávek dorazí do 3 až 4 týdnů od platby, vždy nejpozději do 28 dnů.",
        },
        {
          q: "Kdo mi zásilku doveze?",
          a: "Nařezané a ohranované desky vám přiveze kurýr přímo od našeho výrobního partnera. Kolíky, lepidlo a návod posíláme zvlášť menší zásilkou, například přes Zásilkovnu. Obě části tedy mohou dorazit v jiný den. Konkrétního dopravce předem neurčujeme.",
        },
        {
          q: "Doručujete i mimo Českou republiku?",
          a: "Zatím ne. Objednávky s doručovací adresou mimo ČR teď přijmout nemůžeme. Jakmile to půjde, dáme vědět v newsletteru.",
        },
        {
          q: "Můžu objednávku změnit nebo zrušit?",
          a: "Dokud se váš kus nezačal vyrábět, napište nám co nejdřív a podíváme se, co jde udělat. Jakmile jsou desky nařezané na vaše rozměry, změny už bohužel nejsou možné.",
          link: { href: "/contact", label: "Napsat nám" },
        },
        {
          q: "Můžu nábytek vrátit?",
          a: "Nábytek vyrábíme přesně podle vašich rozměrů, proto u něj podle § 1837 občanského zákoníku nelze odstoupit od smlouvy do 14 dnů. Na vaše práva z vadného plnění to nemá vliv: když něco nesedí naší vinou, vyřešíme to.",
          link: { href: "/legal/complaints-procedure", label: "Reklamační řád" },
        },
        {
          q: "Zásilka přišla poškozená. Co teď?",
          a: "Zásilku si při převzetí prohlédněte. Pokud je obal nebo díl poškozený, vyfoťte ho a napište nám co nejdřív. Ozveme se bez zbytečného odkladu a domluvíme náhradu.",
          link: { href: "/contact", label: "Nahlásit poškození" },
        },
      ] as Faq[],
      helpTitle: "Nenašli jste odpověď?",
      helpBody: "Napište nám. Odpovídáme obvykle do jednoho pracovního dne.",
      helpCta: "Kontaktovat Myble",
    },

    refer: {
      eyebrow: "Doporučte Myble",
      title: `Dejte ${FRIEND}. Získejte ${REWARD}.`,
      body: `Pošlete kamarádovi svůj kód. On ušetří ${FRIEND} na svůj první kus na míru a vy dostanete ${REWARD} na další, jakmile jeho objednávka půjde do výroby.`,
      arrivedTitle: `Kamarád vám posílá ${FRIEND}`,
      arrivedBody: (code: string) =>
        `Kód ${code} jsme si zapamatovali, v pokladně se doplní sám. Platí na první objednávku se sadou od ${FRIEND_MIN}.`,
      arrivedCta: "Navrhnout svůj kus",
      yourCode: "Váš kód",
      copyLink: "Kopírovat odkaz",
      copied: "Zkopírováno",
      share: "Sdílet",
      shareText: `Navrhni si nábytek na míru v Myble a s mým kódem ušetříš ${FRIEND} na první objednávku.`,
      statsConfirmed: "potvrzená doporučení",
      statsPending: "čeká na potvrzení",
      loggedOutTitle: "Váš kód na vás čeká",
      loggedOutBody: "Přihlaste se a hned dostanete svůj kód a odkaz ke sdílení.",
      login: "Přihlásit se",
      loading: "Načítám váš kód…",
      steps: [
        { n: "01", t: "Sdílejte svůj kód", d: "Najdete ho tady nebo v účtu v sekci Odměny. Pošlete ho komukoli, kdo hledá nábytek, který jinde nesežene." },
        { n: "02", t: `Kamarád ušetří ${FRIEND}`, d: `Otevře váš odkaz nebo zadá kód v pokladně a ${FRIEND} se mu odečte z první objednávky od ${FRIEND_MIN}.` },
        { n: "03", t: `Vy dostanete ${REWARD}`, d: "Jakmile kamarád zaplatí a jeho kus jde do výroby, pošleme vám voucher e-mailem." },
      ],
      faqTitle: "Jak to funguje",
      faq: [
        {
          q: "Kde najdu svůj kód?",
          a: "Po přihlášení nahoře na této stránce a kdykoli v účtu v sekci Odměny. Kód je jen váš a nemění se.",
          link: { href: "/account/rewards", label: "Moje odměny" },
        },
        {
          q: "Jak kamarád slevu uplatní?",
          a: `Stačí, když otevře váš odkaz: kód si zapamatujeme a v pokladně se doplní sám. Nebo ho zadá ručně do pole Slevový kód. Sleva platí pro nového zákazníka na první objednávku se sadou od ${FRIEND_MIN}.`,
        },
        {
          q: "Kdy dostanu odměnu?",
          a: `Jakmile je kamarádova objednávka zaplacená a potvrzená. Voucher na ${REWARD} vám přijde e-mailem a najdete ho i v účtu. Platí 12 měsíců na sadu od ${REWARD_MIN}.`,
        },
        {
          q: "Kolik lidí můžu doporučit?",
          a: "Kolik chcete. Za každého nového zákazníka, jehož objednávka půjde do výroby, dostanete jeden voucher.",
        },
        {
          q: "Něco nefunguje, co mám dělat?",
          a: "Napište nám číslo objednávky a kód, který jste použili. Projdeme to a odměnu případně připíšeme ručně.",
          link: { href: "/contact", label: "Kontaktovat Myble" },
        },
      ] as Faq[],
      terms: `Doručení pouze v ČR. Sleva ${FRIEND} platí jen pro nového zákazníka (e-mail, na který u nás dosud nebyla objednávka) a jen jednou, na sadu od ${FRIEND_MIN}. Vlastní kód nelze použít na vlastní objednávku. Na jednu objednávku lze uplatnit jeden kód. Voucher pro doporučujícího vzniká až po zaplacení a potvrzení objednávky, platí 12 měsíců na sadu od ${REWARD_MIN}, je vázaný na e-mail a nelze ho směnit za peníze. Při zrušení objednávky odměna za ni propadá. Pokud doporučení vypadá jako doporučení sebe sama (stejná adresa nebo telefon), odměnu nevyplatíme.`,
    },

    plus: {
      eyebrow: "Věrnostní program",
      title: "myble+",
      titleSub: "Odměna za každý kus na míru.",
      body: "S každou objednávkou sbíráte body a měníte je za slevu na další nábytek. Stačí účet Myble, nic dalšího se nevyplňuje.",
      join: "Přidat se",
      steps: [
        { n: "01", t: "Přihlaste se", d: "Účet založíte jedním kliknutím přes Google. Body se připisují k e-mailu, na který objednáváte." },
        { n: "02", t: "Sbírejte body", d: `1 bod za každých ${LOYALTY_CZK_PER_POINT} Kč z ceny sady a ${LOYALTY_DESIGN_PUBLISHED_POINTS} bodů za každý váš návrh, který přijmeme do knihovny.` },
        { n: "03", t: "Vyměňte je za slevu", d: "Body proměníte ve voucher jedním kliknutím a zadáte ho v pokladně." },
      ],
      earnTitle: "Za co body dostanete",
      earn: [
        { v: `1 bod / ${LOYALTY_CZK_PER_POINT} Kč`, t: "Objednávky", d: "Z ceny sady po slevě. Doprava se nepočítá." },
        { v: `${LOYALTY_DESIGN_PUBLISHED_POINTS} bodů`, t: "Návrh v knihovně", d: "Za každý váš návrh, který schválíme do veřejné knihovny." },
      ],
      rewardsTitle: "Body proměňte ve slevu",
      rewardPoints: (p: number) => `${n(p)} bodů`,
      rewardMin: (min: number) => `na sadu od ${czk(min)}`,
      redeem: "Vyměnit",
      redeeming: "Měním…",
      needMore: (p: number) => `Chybí ${n(p)} bodů`,
      balance: "Váš zůstatek",
      points: (p: number) => `${n(p)} ${p === 1 ? "bod" : p >= 2 && p <= 4 ? "body" : "bodů"}`,
      nextReward: (p: number, c: string) => `Ještě ${n(p)} bodů a máte nárok na slevu ${c}.`,
      allUnlocked: "Máte dost bodů na kteroukoli odměnu.",
      redeemed: (code: string) => `Hotovo. Váš voucher ${code} najdete v účtu v sekci Odměny.`,
      redeemFailed: "Výměna se nepovedla. Zkuste to prosím znovu.",
      loggedOutTitle: "Body se začnou počítat hned",
      loggedOutBody: "Přihlaste se a uvidíte svůj zůstatek. Body za objednávky na váš e-mail se připíšou i zpětně.",
      faqTitle: "Časté otázky",
      faq: [
        {
          q: "Co je myble+?",
          a: "Věrnostní program Myble. Za objednávky a za návrhy, které přijmeme do knihovny, dostáváte body a měníte je za slevu na další kus.",
        },
        {
          q: "Jak se zapojím?",
          a: "Přihlaste se přes Google. Body jsou vázané na e-mail, takže se vám připíšou i za objednávky, které jste udělali bez přihlášení na stejný e-mail.",
        },
        {
          q: "Kdy se mi body připíšou?",
          a: "Jakmile je objednávka zaplacená a potvrzená. Počítá se cena sady po slevě, doprava ne. Když objednávku zrušíme, body za ni se odečtou.",
        },
        {
          q: "Jak body uplatním?",
          a: "Na této stránce nebo v účtu v sekci Odměny vyberte odměnu a klikněte na Vyměnit. Dostanete kód, který zadáte v pokladně do pole Slevový kód. Na objednávku lze použít jeden kód.",
          link: { href: "/account/rewards", label: "Moje odměny" },
        },
        {
          q: "Propadají body?",
          a: "Body nepropadají. Voucher, na který je vyměníte, platí 12 měsíců.",
        },
      ] as Faq[],
      referTitle: `Dejte ${FRIEND}. Získejte ${REWARD}.`,
      referBody: "Doporučte Myble kamarádovi a oba ušetříte na dalším kusu.",
      referCta: "Doporučit kamarádovi",
      terms: `Body se připisují k e-mailu objednávky po jejím zaplacení a potvrzení. 1 bod za každých ${LOYALTY_CZK_PER_POINT} Kč z ceny sady po slevě, bez dopravy. Vouchery jsou vázané na e-mail, platí 12 měsíců, nelze je směnit za peníze a na jednu objednávku lze uplatnit jeden kód. Program můžeme upravit nebo ukončit; body získané do té doby vám zůstanou k výměně nejméně 3 měsíce.`,
    },

    library: {
      // The fourth bar item points at the library itself; no page of its own.
    },

    checkout: {
      codeToggle: "Máte slevový kód?",
      codeLabel: "Slevový kód",
      codePlaceholder: "např. TEREZA7K3Q",
      apply: "Použít",
      applying: "Ověřuji…",
      remove: "Odebrat",
      discountRow: (code: string) => `Sleva (${code})`,
      needEmail: "Nejdřív prosím vyplňte e-mail. Kód ověřujeme podle něj.",
      reasons: {
        not_found: "Tenhle kód neznáme. Zkontrolujte prosím, jestli je opsaný správně.",
        email_required: "Nejdřív prosím vyplňte e-mail.",
        own_code: "Vlastní doporučovací kód nejde použít na vlastní objednávku.",
        not_new_customer: "Doporučovací kód platí jen na první objednávku nového zákazníka.",
        min_order: (min: string) => `Kód platí na sadu od ${min}.`,
        used: "Tenhle voucher už byl použitý.",
        expired: "Platnost voucheru vypršela.",
        wrong_email: "Voucher patří k jinému e-mailu. Zadejte e-mail, na který přišel.",
        unavailable: "Kód teď nejde ověřit. Zkuste to prosím za chvíli.",
      } as Record<string, string | ((min: string) => string)>,
      promoRejected: "Slevový kód se při odeslání nepodařilo uplatnit, objednávku jsme proto neodeslali.",
    },

    account: {
      title: "Odměny",
      intro: "Váš doporučovací kód, body myble+ a vouchery na jednom místě.",
      referTitle: "Doporučte kamarádovi",
      referBody: `Kamarád ušetří ${FRIEND}, vy dostanete ${REWARD}.`,
      plusTitle: "myble+ body",
      vouchersTitle: "Vaše vouchery",
      vouchersEmpty: "Zatím tu nic není. Vouchery přibudou za doporučení a výměnou bodů.",
      voucherFrom: (min: string) => `na sadu od ${min}`,
      voucherExpires: (d: string) => `platí do ${d}`,
      voucherUsed: (o: string) => `použito v objednávce ${o}`,
      voucherExpired: "propadlo",
      sourceReferral: "za doporučení",
      sourceLoyalty: "za body",
      historyTitle: "Historie bodů",
      historyEmpty: "Body se objeví po první potvrzené objednávce.",
      reasons: {
        order: (ref: string) => `Objednávka ${ref}`,
        order_reversal: (ref: string) => `Zrušená objednávka ${ref}`,
        design_published: () => "Návrh přijatý do knihovny",
        redeem: (ref: string) => `Výměna za voucher ${ref}`,
      } as Record<string, (ref: string) => string>,
      learnMore: "Jak to funguje",
      copyCode: "Kopírovat kód",
    },
  };
}

function en(LIB: string): PromoCopy {
  return {
    bar: {
      label: "Myble offers",
      pause: "Pause the offers ticker",
      play: "Play the offers ticker",
      delivery: `Free delivery over ${FREE}`,
      refer: `Give ${FRIEND}, get ${REWARD}`,
      plus: "myble+ loyalty programme",
      library: `Ready-made designs from ${LIB}`,
    },

    delivery: {
      eyebrow: "Delivery",
      title: "Delivered to your door.",
      body: "Every piece is made to your measurements and shipped as a ready-to-assemble kit anywhere in the Czech Republic.",
      stats: [
        { v: FEE, l: "delivery per order" },
        { v: "0 Kč", l: `when the kit is ${FREE} or more` },
        { v: "3–4 weeks", l: "usually from payment, always within 28 days" },
        { v: "2 parcels", l: "panels in one, hardware in the other" },
      ],
      progressTitle: "Your design in progress",
      progressRemaining: (gap: string) => `You are ${gap} away from free delivery.`,
      progressDone: "This piece ships free.",
      progressCta: "Edit design",
      progressEmpty: "Design a piece and see how far you are from free delivery.",
      progressEmptyCta: "Open the configurator",
      faqTitle: "Delivery questions",
      faq: [
        {
          q: "How much is delivery?",
          a: `Delivery anywhere in Czechia is ${FEE} per order. Once the kit price, after any discount, reaches ${FREE}, delivery is free. You see the exact delivery cost in the configurator and at checkout before you place the order.`,
        },
        {
          q: "When will my order arrive?",
          a: "Production starts once your dimensions are confirmed and payment is received. It usually takes 10 to 15 business days, followed by delivery. Most orders arrive within 3 to 4 weeks of payment, and always within 28 days.",
        },
        {
          q: "Who delivers it?",
          a: "The cut and edge-banded panels come by courier straight from our manufacturing partner. Dowels, glue and the instructions travel separately in a smaller parcel, for example via Zásilkovna, so the two parts may arrive on different days. The specific carrier is not fixed in advance.",
        },
        {
          q: "Do you deliver outside the Czech Republic?",
          a: "Not yet. We can't accept orders with a delivery address outside Czechia for now. When that changes, we'll say so in the newsletter.",
        },
        {
          q: "Can I change or cancel my order?",
          a: "If production hasn't started, write to us as soon as you can and we'll see what's possible. Once the panels are cut to your measurements, changes are no longer possible.",
          link: { href: "/contact", label: "Write to us" },
        },
        {
          q: "Can I return my furniture?",
          a: "Your furniture is made to your exact measurements, so under § 1837 of the Czech Civil Code the 14-day right of withdrawal does not apply. Your rights for defective goods are unaffected: if something is wrong because of us, we'll put it right.",
          link: { href: "/legal/complaints-procedure", label: "Complaints procedure" },
        },
        {
          q: "My parcel arrived damaged. What now?",
          a: "Check the parcel when you receive it. If the box or a part is damaged, take photos and write to us as soon as you can. We'll get back to you without undue delay and arrange a replacement.",
          link: { href: "/contact", label: "Report damage" },
        },
      ],
      helpTitle: "Didn't find your answer?",
      helpBody: "Write to us. We usually reply within one business day.",
      helpCta: "Contact Myble",
    },

    refer: {
      eyebrow: "Refer a friend",
      title: `Give ${FRIEND}. Get ${REWARD}.`,
      body: `Send a friend your code. They save ${FRIEND} on their first made-to-measure piece, and you get ${REWARD} toward your next one as soon as their order goes into production.`,
      arrivedTitle: `A friend sent you ${FRIEND}`,
      arrivedBody: (code: string) =>
        `We've saved the code ${code} and it will fill itself in at checkout. Valid on a first order with a kit from ${FRIEND_MIN}.`,
      arrivedCta: "Design your piece",
      yourCode: "Your code",
      copyLink: "Copy link",
      copied: "Copied",
      share: "Share",
      shareText: `Design made-to-measure furniture at Myble and save ${FRIEND} on your first order with my code.`,
      statsConfirmed: "confirmed referrals",
      statsPending: "awaiting confirmation",
      loggedOutTitle: "Your code is waiting",
      loggedOutBody: "Log in and get your code and share link straight away.",
      login: "Log in",
      loading: "Loading your code…",
      steps: [
        { n: "01", t: "Share your code", d: "Find it here or under Rewards in your account. Send it to anyone looking for furniture they can't find anywhere else." },
        { n: "02", t: `Your friend saves ${FRIEND}`, d: `They open your link or enter the code at checkout, and ${FRIEND} comes off a first order from ${FRIEND_MIN}.` },
        { n: "03", t: `You get ${REWARD}`, d: "Once your friend has paid and their piece goes into production, we e-mail you a voucher." },
      ],
      faqTitle: "How it works",
      faq: [
        {
          q: "Where do I find my code?",
          a: "Once you're logged in, at the top of this page and any time under Rewards in your account. The code is yours and doesn't change.",
          link: { href: "/account/rewards", label: "My rewards" },
        },
        {
          q: "How does my friend use it?",
          a: `They just open your link: we remember the code and it fills itself in at checkout. Or they type it into the Discount code field. It works for a new customer's first order with a kit from ${FRIEND_MIN}.`,
        },
        {
          q: "When do I get my reward?",
          a: `As soon as your friend's order is paid and confirmed. The ${REWARD} voucher arrives by e-mail and shows up in your account. It's valid for 12 months on kits from ${REWARD_MIN}.`,
        },
        {
          q: "How many people can I refer?",
          a: "As many as you like. You get one voucher for every new customer whose order goes into production.",
        },
        {
          q: "Something isn't working. What should I do?",
          a: "Send us the order number and the code that was used. We'll look into it and add the reward by hand if needed.",
          link: { href: "/contact", label: "Contact Myble" },
        },
      ],
      terms: `Delivery within Czechia only. The ${FRIEND} discount is for new customers only (an e-mail address that hasn't ordered from us before), once, on a kit from ${FRIEND_MIN}. You can't use your own code on your own order. One code per order. The referrer's voucher is issued only after the order is paid and confirmed, is valid for 12 months on kits from ${REWARD_MIN}, is tied to your e-mail and can't be exchanged for cash. If the order is cancelled, its reward lapses. If a referral looks like a self-referral (same address or phone), no reward is paid.`,
    },

    plus: {
      eyebrow: "Loyalty programme",
      title: "myble+",
      titleSub: "A reward for every made-to-measure piece.",
      body: "Collect points with every order and swap them for money off your next piece. All you need is a Myble account, nothing else to fill in.",
      join: "Join now",
      steps: [
        { n: "01", t: "Log in", d: "Create an account in one click with Google. Points are tied to the e-mail you order with." },
        { n: "02", t: "Collect points", d: `1 point for every ${LOYALTY_CZK_PER_POINT} Kč of kit price, plus ${LOYALTY_DESIGN_PUBLISHED_POINTS} points for every design of yours we accept into the library.` },
        { n: "03", t: "Swap them for a discount", d: "Turn points into a voucher in one click and enter it at checkout." },
      ],
      earnTitle: "How you earn points",
      earn: [
        { v: `1 pt / ${LOYALTY_CZK_PER_POINT} Kč`, t: "Orders", d: "On the kit price after discounts. Delivery doesn't count." },
        { v: `${LOYALTY_DESIGN_PUBLISHED_POINTS} pts`, t: "A design in the library", d: "For every design of yours we approve into the public library." },
      ],
      rewardsTitle: "Turn points into money off",
      rewardPoints: (p: number) => `${n(p)} points`,
      rewardMin: (min: number) => `on kits from ${czk(min)}`,
      redeem: "Redeem",
      redeeming: "Redeeming…",
      needMore: (p: number) => `${n(p)} points to go`,
      balance: "Your balance",
      points: (p: number) => `${n(p)} ${p === 1 ? "point" : "points"}`,
      nextReward: (p: number, c: string) => `${n(p)} more points and you can claim ${c} off.`,
      allUnlocked: "You have enough points for any reward.",
      redeemed: (code: string) => `Done. Your voucher ${code} is waiting under Rewards in your account.`,
      redeemFailed: "That didn't work. Please try again.",
      loggedOutTitle: "Points start counting straight away",
      loggedOutBody: "Log in to see your balance. Points for orders placed with your e-mail are added retroactively.",
      faqTitle: "FAQs",
      faq: [
        {
          q: "What is myble+?",
          a: "Myble's loyalty programme. You earn points for orders and for designs we accept into the library, and swap them for money off your next piece.",
        },
        {
          q: "How do I join?",
          a: "Log in with Google. Points are tied to your e-mail, so orders you placed without logging in, using the same e-mail, count too.",
        },
        {
          q: "When are points added?",
          a: "As soon as an order is paid and confirmed. Points are based on the kit price after discounts, not delivery. If an order is cancelled, its points are taken back.",
        },
        {
          q: "How do I use my points?",
          a: "Pick a reward on this page or under Rewards in your account and click Redeem. You get a code to enter in the Discount code field at checkout. One code per order.",
          link: { href: "/account/rewards", label: "My rewards" },
        },
        {
          q: "Do points expire?",
          a: "Points don't expire. The voucher you swap them for is valid for 12 months.",
        },
      ],
      referTitle: `Give ${FRIEND}. Get ${REWARD}.`,
      referBody: "Recommend Myble to a friend and you both save on your next piece.",
      referCta: "Refer a friend",
      terms: `Points are added to the order's e-mail once the order is paid and confirmed: 1 point for every ${LOYALTY_CZK_PER_POINT} Kč of kit price after discounts, excluding delivery. Vouchers are tied to your e-mail, valid for 12 months, can't be exchanged for cash, and one code can be used per order. We may change or end the programme; points earned until then stay redeemable for at least 3 months.`,
    },

    library: {},

    checkout: {
      codeToggle: "Have a discount code?",
      codeLabel: "Discount code",
      codePlaceholder: "e.g. TEREZA7K3Q",
      apply: "Apply",
      applying: "Checking…",
      remove: "Remove",
      discountRow: (code: string) => `Discount (${code})`,
      needEmail: "Please fill in your e-mail first. We check the code against it.",
      reasons: {
        not_found: "We don't recognise this code. Please check it's typed correctly.",
        email_required: "Please fill in your e-mail first.",
        own_code: "You can't use your own referral code on your own order.",
        not_new_customer: "Referral codes are for a new customer's first order only.",
        min_order: (min: string) => `This code works on kits from ${min}.`,
        used: "This voucher has already been used.",
        expired: "This voucher has expired.",
        wrong_email: "This voucher belongs to a different e-mail. Use the address it was sent to.",
        unavailable: "We can't check the code right now. Please try again in a moment.",
      },
      promoRejected: "The discount code couldn't be applied when sending, so the order was not placed.",
    },

    account: {
      title: "Rewards",
      intro: "Your referral code, myble+ points and vouchers in one place.",
      referTitle: "Refer a friend",
      referBody: `Your friend saves ${FRIEND}, you get ${REWARD}.`,
      plusTitle: "myble+ points",
      vouchersTitle: "Your vouchers",
      vouchersEmpty: "Nothing here yet. Vouchers appear for referrals and when you redeem points.",
      voucherFrom: (min: string) => `on kits from ${min}`,
      voucherExpires: (d: string) => `valid until ${d}`,
      voucherUsed: (o: string) => `used on order ${o}`,
      voucherExpired: "expired",
      sourceReferral: "referral reward",
      sourceLoyalty: "from points",
      historyTitle: "Points history",
      historyEmpty: "Points appear after your first confirmed order.",
      reasons: {
        order: (ref: string) => `Order ${ref}`,
        order_reversal: (ref: string) => `Cancelled order ${ref}`,
        design_published: () => "Design accepted into the library",
        redeem: (ref: string) => `Swapped for voucher ${ref}`,
      },
      learnMore: "How it works",
      copyCode: "Copy code",
    },
  };
}

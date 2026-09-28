import { describe, expect, it } from "vitest";
import {
  detectLocale,
  localeFromAcceptLanguage,
  localeFromLanguages,
  localizePath,
  pathLocaleSegment,
  stripLocale,
} from "./locale";

describe("localeFromAcceptLanguage", () => {
  it("picks Czech for a Czech browser", () => {
    expect(localeFromAcceptLanguage("cs-CZ,cs;q=0.9,en;q=0.8")).toBe("cs");
  });
  it("treats Slovak as Czech", () => {
    expect(localeFromAcceptLanguage("sk-SK,sk;q=0.9")).toBe("cs");
  });
  it("falls back to English for other languages and no header", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
  it("respects q-weights over header order", () => {
    expect(localeFromAcceptLanguage("en;q=0.5,cs;q=0.9")).toBe("cs");
    expect(localeFromAcceptLanguage("de,en;q=0.8,cs;q=0.3")).toBe("en");
  });
  it("ignores languages refused with q=0", () => {
    expect(localeFromAcceptLanguage("cs;q=0,en")).toBe("en");
  });
});

describe("localeFromLanguages", () => {
  it("uses the first recognised navigator language", () => {
    expect(localeFromLanguages(["pl", "cs-CZ", "en"])).toBe("cs");
    expect(localeFromLanguages(["en-GB", "cs"])).toBe("en");
    expect(localeFromLanguages([])).toBe("en");
  });
});

describe("detectLocale", () => {
  it("lets an earlier explicit choice beat the browser language", () => {
    expect(detectLocale({ cookie: "en", acceptLanguage: "cs-CZ" })).toBe("en");
    expect(detectLocale({ cookie: "cs", acceptLanguage: "en-US" })).toBe("cs");
  });
  it("ignores a malformed cookie", () => {
    expect(detectLocale({ cookie: "fr", acceptLanguage: "cs" })).toBe("cs");
  });
});

describe("localizePath", () => {
  it("prefixes site paths", () => {
    expect(localizePath("/", "cs")).toBe("/cz");
    expect(localizePath("/design", "cs")).toBe("/cz/design");
    expect(localizePath("/design?d=abc", "en")).toBe("/en/design?d=abc");
    expect(localizePath("/#jak", "cs")).toBe("/cz#jak");
    expect(localizePath("/?x=1", "en")).toBe("/en?x=1");
  });
  it("re-targets an already-prefixed path", () => {
    expect(localizePath("/en/about", "cs")).toBe("/cz/about");
    expect(localizePath("/cz", "en")).toBe("/en");
  });
  it("leaves unrouted, external and hash links alone", () => {
    expect(localizePath("/admin/orders", "cs")).toBe("/admin/orders");
    expect(localizePath("/api/profile", "cs")).toBe("/api/profile");
    expect(localizePath("/brand", "cs")).toBe("/brand");
    expect(localizePath("https://example.com", "cs")).toBe("https://example.com");
    expect(localizePath("//cdn.example.com/x", "cs")).toBe("//cdn.example.com/x");
    expect(localizePath("#top", "cs")).toBe("#top");
    expect(localizePath("mailto:hello@my-ble.eu", "cs")).toBe("mailto:hello@my-ble.eu");
  });
  it("does not mistake look-alike paths for unrouted ones", () => {
    expect(localizePath("/administration", "cs")).toBe("/cz/administration");
    expect(localizePath("/branding", "en")).toBe("/en/branding");
  });
});

describe("stripLocale / pathLocaleSegment", () => {
  it("removes only a real locale prefix", () => {
    expect(stripLocale("/cz/design")).toBe("/design");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/en?x=1")).toBe("/?x=1");
    expect(stripLocale("/cz#jak")).toBe("/#jak");
    expect(stripLocale("/design")).toBe("/design");
    expect(stripLocale("/czech")).toBe("/czech");
  });
  it("reads the segment", () => {
    expect(pathLocaleSegment("/cz/about")).toBe("cz");
    expect(pathLocaleSegment("/en")).toBe("en");
    expect(pathLocaleSegment("/about")).toBeNull();
    expect(pathLocaleSegment("/czech")).toBeNull();
  });
});

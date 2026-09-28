import type { Metadata } from "next";
import { RootShell } from "../RootShell";
import { SITE_URL } from "../../lib/structuredData";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Brand | Myble",
  robots: { index: false, follow: false },
};

export default function BrandRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="en">{children}</RootShell>;
}

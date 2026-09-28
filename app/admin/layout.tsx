import type { Metadata } from "next";
import { RootShell } from "../RootShell";
import { SITE_URL } from "../../lib/structuredData";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="en">{children}</RootShell>;
}

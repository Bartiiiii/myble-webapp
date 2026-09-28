import type { Metadata } from "next";

const TITLE = "About Myble | why we exist";
const DESCRIPTION =
  "Myble started with one piece of furniture that didn't exist, and three weekends spent building it. The drawing, the cut list, the queue, the borrowed drill, and what we built so you don't have to.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "article",
    url: "/about",
    siteName: "Myble",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

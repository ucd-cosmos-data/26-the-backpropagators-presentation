import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "PBMC3k — Decoding the immune system",
    template: "%s · PBMC3k",
  },
  description:
    "An interactive, end-to-end exploration of 2,638 peripheral blood mononuclear cells through single-cell RNA sequencing.",
  openGraph: {
    title: "PBMC3k — Decoding the immune system",
    description:
      "From raw gene counts to nine immune-cell populations and predictive models.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

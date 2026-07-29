import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "PBMC3k — From blood cells to an immune-cell map",
    template: "%s · PBMC3k",
  },
  description:
    "A beginner-friendly walkthrough of how 2,700 single-cell RNA profiles became 2,638 quality-checked cells, nine reviewed immune-cell types, and a tested classifier.",
  openGraph: {
    title: "PBMC3k — From blood cells to an immune-cell map",
    description:
      "Follow the full analysis from raw RNA counts through quality control, mapping, clustering, annotation, and model evaluation.",
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

import type { Metadata } from "next";
import { headers } from "next/headers";
import "./styles.css";
import "./one-page.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const title = "PBMC3k — From blood cells to an immune-cell map";
  const description =
    "An evidence-grounded walkthrough of how single-cell RNA profiles became reviewed immune-cell populations, a tested classifier, literature-supported interpretations, and an external-donor evaluation.";

  return {
    title: {
      default: title,
      template: "%s · PBMC3k",
    },
    description,
    openGraph: {
      title,
      description:
        "Explore the complete analysis from quality control and clustering through classification, PubMed evidence, biological reasoning, validation, and an interactive prediction.",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "PBMC3k evidence-grounded immune map" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

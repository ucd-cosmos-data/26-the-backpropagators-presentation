import type { Metadata } from "next";
import Presentation from "@/components/Presentation";

export const metadata: Metadata = {
  title: "Try the cell classifier",
  description:
    "Choose a PBMC3k cell and inspect the XGBoost classifier’s predicted cell type and probabilities.",
};

export default function TryPage() {
  return <Presentation />;
}

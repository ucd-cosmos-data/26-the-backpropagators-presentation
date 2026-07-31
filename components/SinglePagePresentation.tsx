"use client";

import {
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { withBasePath } from "@/lib/paths";

type FigureHotspot = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  kicker: string;
  title: string;
  explanation: string;
};
type Figure = {
  src: string;
  alt: string;
  label: string;
  caption: string;
  hotspots?: FigureHotspot[];
};
type StudySlide = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  notes: { label: string; value: string }[];
  points: { term: string; explanation: string }[];
  figures: Figure[];
};
type CellPrediction = {
  number: number;
  barcode: string;
  cell_id?: string;
  split: "training" | "validation" | "test" | "external";
  reviewed: string;
  predicted: string;
  confidence: number | null;
  probabilities: number[];
  annotation_only?: boolean;
};
type PredictionPayload = {
  dataset?: string;
  model: string;
  classes: string[];
  cell_count: number;
  test_accuracy?: number;
  test_macro_f1?: number;
  external_accuracy?: number;
  cells: CellPrediction[];
};

const modelDatasets = {
  pbmc3k: {
    label: "PBMC3k",
    url: "/data/pbmc3k-cell-predictions.json",
    description: "The original nine-class model results, including the original train, validation, and untouched test splits.",
  },
  pbmc4k: {
    label: "PBMC4k",
    url: "/data/pbmc4k-cell-predictions.json",
    description: "An external donor tested with the PBMC3k-trained model. It reached 95.9% broad-label agreement across the six supported categories; reviewed dendritic cells are identified separately.",
  },
} as const;

type DatasetKey = keyof typeof modelDatasets;

const markerGenes = [
  "CD8A", "CCL5", "MS4A1", "CD79A", "IL7R", "LTB", "S100A8", "FCN1", "FCGR3A",
  "LST1", "GNLY", "NKG7", "GZMK", "IL32", "CCR7", "MAL", "PPBP", "PF4",
] as const;

const markerCellTypes = [
  "IL7R+ memory/helper T cells",
  "Classical monocytes",
  "Naive/resting T cells",
  "B cells",
  "Cytotoxic CD8 T cells",
  "CD16+ non-classical monocytes",
  "NK cells",
  "Activated/transitional T cells",
  "Platelets",
] as const;

const markerGeneRoles: Record<(typeof markerGenes)[number], string> = {
  CD8A: "CD8A supports a cytotoxic T-cell identity.",
  CCL5: "CCL5 is associated with activated and cytotoxic lymphocyte programs.",
  MS4A1: "MS4A1, also called CD20, is a canonical B-cell marker.",
  CD79A: "CD79A is part of the B-cell receptor machinery.",
  IL7R: "IL7R supports memory/helper and less-cytotoxic T-cell states.",
  LTB: "LTB is common in lymphocyte identity and signaling programs.",
  S100A8: "S100A8 is characteristic of inflammatory classical monocytes.",
  FCN1: "FCN1 supports a classical-monocyte program.",
  FCGR3A: "FCGR3A, also called CD16, supports non-classical monocytes and can also appear in NK cells.",
  LST1: "LST1 is a broad myeloid-lineage marker.",
  GNLY: "GNLY encodes granulysin and strongly supports cytotoxic NK-cell activity.",
  NKG7: "NKG7 is shared by NK cells and cytotoxic T-cell states.",
  GZMK: "GZMK marks a granzyme-associated cytotoxic or transitional T-cell program.",
  IL32: "IL32 is frequently expressed across several T-cell states.",
  CCR7: "CCR7 supports naive or resting T-cell trafficking and identity.",
  MAL: "MAL is associated with less-differentiated and resting T-cell states.",
  PPBP: "PPBP is a strong platelet-associated chemokine marker.",
  PF4: "PF4 is a canonical platelet marker.",
};

const coreMarkerPrograms: Record<(typeof markerCellTypes)[number], readonly string[]> = {
  "IL7R+ memory/helper T cells": ["IL7R", "LTB", "IL32"],
  "Classical monocytes": ["S100A8", "FCN1", "LST1"],
  "Naive/resting T cells": ["IL7R", "LTB", "IL32", "CCR7", "MAL"],
  "B cells": ["MS4A1", "CD79A"],
  "Cytotoxic CD8 T cells": ["CD8A", "CCL5", "NKG7", "GZMK", "IL32"],
  "CD16+ non-classical monocytes": ["S100A8", "FCN1", "FCGR3A", "LST1"],
  "NK cells": ["CCL5", "FCGR3A", "GNLY", "NKG7", "IL32"],
  "Activated/transitional T cells": ["CD8A", "CCL5", "IL7R", "LTB", "NKG7", "GZMK", "IL32", "CCR7", "MAL"],
  "Platelets": ["PPBP", "PF4"],
};

function buildMarkerDotplotHotspots(): FigureHotspot[] {
  const plot = { left: 29.4, top: 5.5, width: 53.4, height: 72.8 };
  const columnWidth = plot.width / markerGenes.length;
  const rowHeight = plot.height / markerCellTypes.length;

  return markerCellTypes.flatMap((cellType, row) =>
    markerGenes.map((gene, column) => {
      const supportsProgram = coreMarkerPrograms[cellType].includes(gene);
      return {
        id: `marker-${row}-${column}`,
        x: plot.left + columnWidth * (column + 0.5),
        y: plot.top + rowHeight * (row + 0.5),
        width: columnWidth,
        height: rowHeight,
        kicker: supportsProgram ? "LABEL-SUPPORTING SIGNAL" : "CROSS-LINEAGE CHECK",
        title: `${cellType} × ${gene}`,
        explanation: `${markerGeneRoles[gene]} ${
          supportsProgram
            ? `At this intersection, the dot contributes to the coordinated marker program supporting the ${cellType} label.`
            : "This intersection helps show whether the gene is absent, weakly shared, or expressed outside its best-known lineage; one cross-lineage signal should not outweigh the full marker program."
        } Dot size is the fraction of cells expressing the gene; darker color means higher average expression within that cell type.`,
      };
    }),
  );
}

const confusionLabels = [
  "Activated T", "B cells", "CD16+ monocytes", "Classical monocytes", "Cytotoxic CD8 T",
  "IL7R+ T", "NK cells", "Naive T", "Platelets",
] as const;

const confusionValues = [
  [0.54, 0, 0, 0, 0.08, 0.31, 0, 0.08, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0.02, 0.98, 0, 0, 0, 0, 0],
  [0.04, 0, 0, 0, 0.82, 0.07, 0.04, 0.04, 0],
  [0.02, 0, 0, 0, 0.02, 0.92, 0, 0.05, 0],
  [0, 0, 0, 0, 0.07, 0, 0.93, 0, 0],
  [0.04, 0, 0, 0, 0.02, 0.11, 0, 0.82, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1],
] as const;

function buildConfusionMatrixHotspots(): FigureHotspot[] {
  const plot = { left: 17.5, top: 3.4, width: 79.7, height: 79.7 };
  const cellWidth = plot.width / confusionLabels.length;
  const cellHeight = plot.height / confusionLabels.length;

  return confusionValues.flatMap((rowValues, row) =>
    rowValues.map((value, column) => {
      const isCorrect = row === column;
      const percent = Math.round(value * 100);
      return {
        id: `confusion-${row}-${column}`,
        x: plot.left + cellWidth * (column + 0.5),
        y: plot.top + cellHeight * (row + 0.5),
        width: cellWidth,
        height: cellHeight,
        kicker: isCorrect ? "CORRECT CLASSIFICATION" : value > 0 ? "MISCLASSIFICATION" : "NO OBSERVED ERROR",
        title: `${confusionLabels[row]} → ${confusionLabels[column]}`,
        explanation: isCorrect
          ? `${percent}% of the untouched-test cells with the true label “${confusionLabels[row]}” were correctly predicted as that same class. Dark diagonal cells are the desired pattern.`
          : value > 0
            ? `${percent}% of true “${confusionLabels[row]}” test cells were predicted as “${confusionLabels[column]}.” This off-diagonal value reveals where the model confuses related expression states.`
            : `No true “${confusionLabels[row]}” test cells were assigned to “${confusionLabels[column]}” in this held-out split. A zero in one small test set is not proof that the error can never occur.`,
      };
    }),
  );
}

const modelComparisonHotspots: FigureHotspot[] = [
  {
    id: "model-xgboost",
    x: 12.7,
    y: 28,
    width: 8.7,
    height: 51,
    kicker: "VALIDATION-SELECTED WINNER",
    title: "XGBoost",
    explanation: "XGBoost had the highest prespecified validation macro-F1, so it was selected before the untouched test results were used. The four bars compare validation macro-F1, validation ROC AUC, test macro-F1, and test ROC AUC.",
  },
  {
    id: "model-logistic",
    x: 22.3,
    y: 28,
    width: 8.7,
    height: 51,
    kicker: "IMPORTANT COMPARISON",
    title: "Logistic regression",
    explanation: "Logistic regression later produced stronger test estimates than XGBoost, but choosing it after seeing the test set would leak test information into model selection. This is why the validation rule matters.",
  },
  {
    id: "model-neighbors",
    x: 89.5,
    y: 28,
    width: 8.7,
    height: 51,
    kicker: "WEAKEST MODEL HERE",
    title: "K-nearest neighbors",
    explanation: "K-nearest neighbors performed substantially worse, especially on macro-F1. Its local-distance rule struggled more with the overlapping and imbalanced cell-type structure.",
  },
  {
    id: "model-legend",
    x: 27,
    y: 47,
    width: 40,
    height: 16,
    kicker: "HOW TO READ THE BARS",
    title: "Validation versus untouched test",
    explanation: "Macro-F1 gives every cell type equal weight, while ROC AUC measures ranking across one-vs-rest comparisons. Validation bars choose the model; test bars estimate performance only after that choice is frozen.",
  },
];

function areaHotspot(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  kicker: string,
  title: string,
  explanation: string,
): FigureHotspot {
  return { id, x, y, width, height, kicker, title, explanation };
}

const clusterComposition = [
  ["Cytotoxic CD8 T cells", 273, "10.3%"],
  ["B cells", 348, "13.2%"],
  ["IL7R+ memory/helper T cells", 602, "22.8%"],
  ["Classical monocytes", 502, "19.0%"],
  ["CD16+ non-classical monocytes", 171, "6.5%"],
  ["NK cells", 153, "5.8%"],
  ["Activated/transitional T cells", 128, "4.9%"],
  ["Naive/resting T cells", 450, "17.1%"],
  ["Platelets", 11, "0.4%"],
] as const;

function buildCompositionHotspots(mode: "count" | "percentage"): FigureHotspot[] {
  return clusterComposition.map(([cellType, count, percentage], index) =>
    areaHotspot(
      `composition-${mode}-${index}`,
      12.2 + index * 9.65,
      42,
      8.5,
      68,
      index === 8 ? "RARE POPULATION" : index === 2 ? "LARGEST POPULATION" : "CLUSTER COMPOSITION",
      cellType,
      `${cellType} contains ${count.toLocaleString()} of the 2,638 retained cells (${percentage}). ${
        index === 8
          ? "With only 11 cells, platelet percentages and downstream performance estimates are especially sensitive to sampling."
          : index === 2
            ? "This is the largest reviewed population, so overall accuracy can be influenced strongly by how well the model handles it."
            : "Population size provides essential context for marker certainty and classifier performance."
      }`,
    ),
  );
}

const heatmapRowExplanations = [
  ["C0 · Cytotoxic CD8 T cells", "Warm blocks among NKG7, CCL5, GZMA, CST7, and GZMK support a cytotoxic T-cell program."],
  ["C1 · B cells", "The concentrated warm B-cell block includes CD79A, MS4A1, CD79B, and related B-cell identity genes."],
  ["C2 · IL7R+ memory/helper T cells", "Warm IL32, IL7R, CD3D, LTB, and CD3E expression supports memory/helper T-cell identity."],
  ["C3 · Classical monocytes", "S100A8, LGALS2, S100A9, FCN1, and CST3 form a strong classical-monocyte block."],
  ["C4 · CD16+ non-classical monocytes", "FCGR3A, IFITM3, MS4A7, and LST1 distinguish the non-classical monocyte program."],
  ["C5 · NK cells", "GZMB, FGFBP2, GNLY, PRF1, and NKG7 create the clearest cytotoxic NK-cell block."],
  ["C6 · Activated/transitional T cells", "This row has a weaker, more diffuse pattern. That limited specificity is why the later reasoning confidence remains low."],
  ["C7 · Naive/resting T cells", "CCR7 and a restrained T-cell identity program distinguish this population from more cytotoxic T-cell states."],
  ["C8 · Platelets", "PPBP, PF4, GNG11, SDPR, and SPARC form a highly specific platelet block, but it comes from only 11 cells."],
] as const;

function buildHeatmapHotspots(): FigureHotspot[] {
  return heatmapRowExplanations.map(([title, explanation], index) =>
    areaHotspot(
      `heatmap-row-${index}`,
      52.2,
      9.6 + index * 8.55,
      82.5,
      7.8,
      index === 6 ? "WEAKER SPECIFICITY" : "CLUSTER EXPRESSION PROGRAM",
      title,
      `${explanation} Warm red means above-average expression for a gene across clusters; cool blue means below-average expression. Colors are gene-wise z-scores, not raw counts.`,
    ),
  );
}

const markerSpecificityPanels = [
  ["C0 · Cytotoxic CD8 T cells", "NKG7 and CCL5 lead a coherent cytotoxic T-cell marker set."],
  ["C1 · B cells", "CD79A and MS4A1 have very high specificity scores, making the B-cell program especially clear."],
  ["C2 · IL7R+ memory/helper T cells", "IL32, IL7R, CD3D, LTB, and CD3E support this T-cell identity, though scores are lower than the clearest lineage markers."],
  ["C3 · Classical monocytes", "S100A8, LGALS2, and S100A9 show strong specificity for classical monocytes."],
  ["C4 · CD16+ non-classical monocytes", "FCGR3A leads the non-classical monocyte markers, followed by IFITM3, MS4A7, and LST1."],
  ["C5 · NK cells", "GZMB, FGFBP2, GNLY, PRF1, and NKG7 form one of the strongest representative programs."],
  ["C6 · Activated/transitional T cells", "Very low scores and several broadly expressed ribosomal genes show why this label is less specific and later receives low reasoning confidence."],
  ["C7 · Naive/resting T cells", "CCR7 is the clearest marker here; the remaining T-cell genes overlap other related states."],
  ["C8 · Platelets", "PPBP, PF4, GNG11, SDPR, and SPARC are highly specific, but the population contains only 11 cells."],
] as const;

function buildMarkerSpecificityHotspots(): FigureHotspot[] {
  return markerSpecificityPanels.map(([title, explanation], index) =>
    areaHotspot(
      `specificity-panel-${index}`,
      14.5 + (index % 3) * 35.5,
      17 + Math.floor(index / 3) * 32.6,
      25.5,
      27,
      index === 6 ? "LOW-SPECIFICITY WARNING" : "REPRESENTATIVE MARKERS",
      title,
      `${explanation} The marker score combines fold change, within-versus-outside prevalence, and statistical support; it is not a causal effect size.`,
    ),
  );
}

const evidenceOverviewHotspots: FigureHotspot[] = [
  ["9 clusters", "All nine reviewed PBMC3k populations were included in the evidence workflow."],
  ["90 cluster–gene entries", "Ten representative genes were selected for each of nine clusters. Repeated genes can appear in more than one cluster."],
  ["78 unique genes", "After deduplicating the 90 cluster–gene entries, 78 distinct genes required evidence review."],
  ["231 verified reference rows", "These are gene-to-publication evidence links. Multiple rows can point to the same PubMed paper."],
  ["224 unique verified PMIDs", "Each unique PubMed identifier was verified against NCBI metadata; this is the distinct-paper count."],
  ["11 reused genes", "When the same gene appeared in multiple clusters, its verified literature was reused while cluster-specific marker statistics stayed separate."],
  ["9 Phase 8 validation passes", "Every cluster reasoning response passed the structural and evidence-grounding checks."],
  ["0 Phase 8 validation failures", "No cluster response failed the validators. This confirms compliance with the evidence contract, not experimental proof."],
  ["1 insufficient-evidence gene", "One representative gene lacked enough direct evidence and remained explicitly unresolved instead of receiving an invented claim."],
].map(([title, explanation], index) =>
  areaHotspot(
    `evidence-card-${index}`,
    17.5 + (index % 3) * 32.7,
    21 + Math.floor(index / 3) * 31.3,
    29,
    25,
    index === 8 ? "TRANSPARENT EVIDENCE GAP" : "AUDITABLE EVIDENCE TOTAL",
    title,
    explanation,
  ),
);

const pipelineStages = [
  ["PBMC3k raw data", "The workflow begins with the original single-cell count matrix; no labels are assumed yet."],
  ["Explore", "File structure, cell barcodes, genes, and basic distributions are checked before modeling."],
  ["Quality control", "Low-quality or unusually complex profiles are filtered using gene-count and mitochondrial-RNA criteria."],
  ["Preprocess", "Counts are normalized and transformed so cells can be compared more fairly."],
  ["Dimension reduction", "PCA compresses gene variation; a neighbor graph and UMAP summarize cell similarity."],
  ["Cluster", "Leiden identifies graph communities while K-means and sensitivity checks provide cross-checks."],
  ["Cell annotation", "Marker programs and human review turn numbered clusters into proposed cell-type labels."],
  ["Marker discovery", "Representative genes are ranked using fold change, specificity, prevalence, and statistical support."],
  ["ML classification", "Nine model families compete under a train/validation/untouched-test design; XGBoost wins by validation macro-F1."],
  ["Verified literature", "Gene-level claims are tied to verified PubMed records with explicit A–E evidence grades."],
  ["Biological reasoning", "Each cluster’s dataset observations and literature are combined under an isolated, evidence-grounded reasoning contract."],
  ["Validation", "Schema, gene, citation, confidence, and safety checks ensure the report stays within supplied evidence."],
  ["Validated reports", "The output is a traceable report for all nine clusters, including uncertainty and unresolved questions."],
] as const;

function buildPipelineHotspots(): FigureHotspot[] {
  return pipelineStages.map(([title, explanation], index) =>
    areaHotspot(
      `pipeline-stage-${index}`,
      4.8 + index * 7.5,
      35.8,
      6.4,
      18,
      `PIPELINE STAGE ${String(index + 1).padStart(2, "0")}`,
      title,
      explanation,
    ),
  );
}

const figureHotspotsBySource: Record<string, FigureHotspot[]> = {
  "/figures/classification-class-balance.png": [
    areaHotspot("balance-largest", 70, 14, 55, 8, "LARGEST CLASS", "IL7R+ memory/helper T cells", "This is the largest reviewed class with 602 cells. Its size makes it influential in overall accuracy, which is why macro-F1 is also reported."),
    areaHotspot("balance-middle", 61, 39, 45, 37, "CLASS IMBALANCE", "Unequal population sizes", "The nine classes differ substantially in size. Accuracy alone can hide poor performance on smaller groups, so the project uses macro-F1 to weight each cell type equally."),
    areaHotspot("balance-platelet", 46, 72, 8, 7, "RARE-CLASS WARNING", "Platelets: 11 cells", "The platelet group is only 0.4% of retained cells. Any percentage calculated from its one-cell test support is extremely unstable."),
  ],
  "/figures/leiden-clusters.png": [
    areaHotspot("leiden-each-dot", 45, 45, 50, 55, "HOW TO READ THE MAP", "Each dot is one cell", "Nearby dots have similar RNA profiles in the selected PCA-neighbor space. UMAP location is a visual summary, not a physical location or direct biological measurement."),
    areaHotspot("leiden-islands", 72, 44, 30, 45, "LOCAL STRUCTURE", "Separated islands and connected gradients", "Separated islands suggest distinct expression neighborhoods, while bridges and gradients can represent related or transitional states. Distance between faraway islands should not be over-interpreted."),
    areaHotspot("leiden-colors", 88, 33, 15, 50, "COMMUNITY LABELS", "Colors are Leiden communities", "The numbers and colors come from graph clustering. Biological names are assigned later using marker genes and review—not from color or UMAP position alone."),
  ],
  "/figures/qc-retained-cell-distributions.png": [
    areaHotspot("qc-library", 19.5, 55, 24, 48, "QUALITY-CONTROL DISTRIBUTION", "Library size", "This histogram counts total UMI molecules per retained cell. Very low totals can indicate weak capture; unusually high totals can indicate unusually complex droplets or doublets."),
    areaHotspot("qc-genes", 52, 55, 25, 48, "FILTERED RANGE", "Detected genes per cell", "Cells were retained between 200 and 2,499 detected genes. The dashed lines mark the dataset-specific lower and upper thresholds."),
    areaHotspot("qc-mito", 85.5, 55, 24, 48, "CELL-STRESS CHECK", "Mitochondrial RNA", "High mitochondrial RNA can signal damaged or stressed cells. The dashed line marks the less-than-5% retention threshold."),
    areaHotspot("qc-total", 50, 8, 34, 8, "QC OUTCOME", "97.7% retained", "Quality control retained 2,638 of 2,700 profiles and removed 62. Retention alone does not prove every remaining droplet is a singlet."),
  ],
  "/figures/eda-pca-umap.png": [
    areaHotspot("eda-pca-first", 13, 34, 11, 20, "LARGEST COMPONENT", "PC1 explains the most selected-gene variance", "The first principal component captures the single largest linear expression pattern, but it still explains only a small fraction of total variation."),
    areaHotspot("eda-pca-ten", 23, 45, 28, 55, "DIMENSION CHOICE", "First 10 PCs used", "The dashed line marks the ten principal components used to construct the 15-neighbor graph. Later PCs each contribute much less variance."),
    areaHotspot("eda-umap", 72, 48, 45, 58, "TWO-DIMENSIONAL EMBEDDING", "UMAP cell map", "Each dot is a cell and nearby points have similar graph neighborhoods. UMAP axes have no biological units, and island sizes or far-distance gaps are not exact measurements."),
    areaHotspot("eda-tiny", 50, 52, 5, 10, "RARE POPULATION", "Tiny isolated platelet group", "The very small isolated group corresponds to the 11-cell platelet population. Its separation is visually strong, but its tiny sample size requires caution."),
  ],
  "/figures/umap-tsne-comparison.png": [
    areaHotspot("embedding-umap", 27, 48, 43, 60, "EMBEDDING CROSS-CHECK", "UMAP view", "UMAP emphasizes local neighbor relationships and often preserves more continuous structure. Exact axis values and global distances should not be interpreted biologically."),
    areaHotspot("embedding-tsne", 74, 48, 43, 60, "EMBEDDING CROSS-CHECK", "t-SNE view", "t-SNE uses a different nonlinear objective. Similar local groups across UMAP and t-SNE reduce concern that the visible neighborhoods are unique to one embedding method."),
  ],
  "/figures/clustering-kmeans-leiden-comparison.png": [
    areaHotspot("cluster-kmeans", 24, 48, 44, 60, "BROAD GEOMETRIC SPLIT", "K-means: K = 2", "K-means partitions PCA space around two centers. It captures broad geometry but cannot follow the finer irregular communities visible in the graph."),
    areaHotspot("cluster-leiden", 74, 48, 44, 60, "GRAPH COMMUNITIES", "Leiden: nine communities", "Leiden follows connectivity in the 15-neighbor graph and produces nine reviewable communities used for marker-based annotation."),
    areaHotspot("cluster-ari", 50, 5, 42, 8, "METHOD AGREEMENT", "Adjusted Rand index = 0.206", "The low adjusted Rand index shows that K-means and Leiden encode substantially different partitions. That is expected because one is a two-group geometric cross-check and the other is a finer graph solution."),
  ],
  "/figures/kmeans-k2-k10-diagnostics.png": [
    areaHotspot("kmeans-elbow", 29, 48, 38, 53, "ELBOW DIAGNOSTIC", "Within-cluster variation", "Inertia always falls as K increases. The geometric bend near K=4 suggests diminishing returns, but it does not uniquely determine the biologically useful solution."),
    areaHotspot("kmeans-k2", 12, 38, 8, 45, "SELECTED BROAD SOLUTION", "K = 2", "K=2 has the strongest silhouette score and is retained as a broad geometric cross-check—not as the final cell-type resolution."),
    areaHotspot("kmeans-k4", 21, 42, 7, 40, "GEOMETRIC ELBOW", "K = 4", "The elbow appears near K=4, illustrating that different diagnostics can recommend different resolutions."),
    areaHotspot("kmeans-silhouette", 76, 48, 39, 53, "SEPARATION DIAGNOSTIC", "Silhouette score", "Higher silhouette values indicate tighter separation from neighboring groups. The decline after K=2 shows that forcing more spherical groups produces less clean K-means partitions."),
  ],
  "/figures/leiden-resolution-diagnostics.png": [
    areaHotspot("leiden-count", 26, 23, 40, 28, "COMMUNITY COUNT", "Resolution controls granularity", "As resolution increases, Leiden finds more communities. Resolution 0.5 yields the nine-community reference."),
    areaHotspot("leiden-separation", 75, 23, 40, 28, "SEPARATION", "Silhouette is near its best at 0.5", "Resolution 0.5 retains strong separation, close to the maximum at 0.4, while producing the desired reviewable structure."),
    areaHotspot("leiden-stability", 26, 72, 40, 28, "REPEAT-RUN STABILITY", "Stable under repeated runs", "Adjusted Rand index measures agreement across repeated clustering runs. Resolution 0.5 is stable, though 0.6–0.7 are slightly higher."),
    areaHotspot("leiden-qc", 75, 72, 40, 28, "TECHNICAL ASSOCIATION", "Lower QC association is preferable", "This panel checks whether clusters track technical-quality variables. Association increases above 0.5, arguing against using the highest resolutions."),
    areaHotspot("leiden-selected", 50, 49, 7, 88, "BALANCED CHOICE", "Why resolution 0.5?", "The selected reference balances nine communities, good separation, repeat stability, manageable technical association, embedding review, and marker interpretability. It is a reasoned choice, not a mathematically unique truth."),
  ],
  "/figures/classification-top-selected-genes.png": [
    areaHotspot("feature-score", 70, 91, 48, 8, "TRAINING-ONLY FEATURE SCORE", "ANOVA F score", "A higher score means the gene separated reviewed classes more strongly within training data. It is a univariate association score—not causal importance and not an XGBoost tree-importance value."),
    areaHotspot("feature-top", 55, 12, 70, 8, "HIGHEST TRAINING SCORES", "TYROBP and CST3", "These myeloid-associated genes have the largest training-only ANOVA scores. Their ranking reflects class separation in the training partition."),
    areaHotspot("feature-lineages", 55, 43, 70, 45, "MULTIPLE LINEAGES REPRESENTED", "Selected genes span immune programs", "The list includes myeloid genes, B-cell genes such as CD79A, cytotoxic genes such as NKG7 and GZMB, and platelet genes such as PF4 and GP9."),
    areaHotspot("feature-leakage", 50, 4, 60, 7, "LEAKAGE SAFEGUARD", "Selection happened inside training data", "Validation and test cells did not influence this feature ranking, preventing information leakage into model selection."),
  ],
  "/figures/cluster-percentages.png": buildCompositionHotspots("percentage"),
  "/figures/cluster-cell-counts.png": buildCompositionHotspots("count"),
  "/figures/representative-marker-heatmap.png": buildHeatmapHotspots(),
  "/figures/marker-specificity.png": buildMarkerSpecificityHotspots(),
  "/figures/evidence-validation-overview.png": evidenceOverviewHotspots,
  "/figures/complete-analysis-pipeline.png": buildPipelineHotspots(),
  "/figures/final-cluster-summary.png": [
    areaHotspot("summary-markers", 37, 50, 28, 80, "REPRESENTATIVE EVIDENCE", "Top marker genes", "These are the five highest-ranked representatives from the saved Phase 6 marker score—not an exhaustive gene list and not a causal signature."),
    areaHotspot("summary-support", 59, 50, 16, 80, "ANNOTATION SUPPORT", "Strong versus partial support", "This column describes how well the combined evidence supports the proposed cell-type identity. It is separate from the original marker-review confidence."),
    areaHotspot("summary-confidence", 71, 50, 13, 80, "REASONING CONFIDENCE", "High, moderate, or low", "This later confidence rating reflects evidence-grounded biological reasoning. It must not be conflated with the earlier seven-high/two-moderate annotation confidence."),
    areaHotspot("summary-program", 87, 50, 20, 80, "DOMINANT PROGRAM", "Evidence-supported biological program", "The program summarizes coordinated functions supported by marker observations and literature while retaining uncertainty about protein activity and cellular state."),
  ],
  "/figures/biological-reasoning-summary.png": [
    areaHotspot("reasoning-support", 38, 50, 24, 76, "ANNOTATION SUPPORT", "How strongly the cell-type name is supported", "Strong support indicates a coordinated and lineage-consistent evidence set; partial support means overlap or unresolved alternatives remain."),
    areaHotspot("reasoning-confidence", 62, 50, 24, 76, "OVERALL REASONING CONFIDENCE", "Confidence in the combined interpretation", "B cells, classical monocytes, and platelets are high; activated/transitional T cells are low; the remaining populations are moderate."),
    areaHotspot("reasoning-pass", 86, 50, 18, 76, "VALIDATION STATUS", "PASS does not mean experimentally proven", "PASS means the response obeyed the schema, used supplied genes and citations, stated uncertainty, and avoided unsupported claims. It is a reasoning-quality check."),
  ],
  "/figures/pbmc4k-reviewed-annotations-umap.png": [
    areaHotspot("pbmc4k-clusters", 27, 48, 43, 62, "SECOND-DONOR CLUSTERING", "PBMC4k Leiden communities", "The second donor was clustered from its own RNA-neighbor graph. These communities were not created by the PBMC3k-trained classifier."),
    areaHotspot("pbmc4k-labels", 73, 48, 43, 62, "INDEPENDENT REVIEW", "PBMC4k reviewed cell types", "Marker-gene review assigns biological names independently of XGBoost, creating a comparison target for external evaluation."),
    areaHotspot("pbmc4k-boundary", 50, 7, 55, 8, "GENERALIZATION TEST", "Why a second donor matters", "Because PBMC4k comes from another person and is reviewed independently, agreement tests transfer beyond the original donor—though one extra donor is still not population-wide validation."),
  ],
  "/figures/pbmc4k-marker-validation.png": [
    areaHotspot("pbmc4k-dot-size", 84, 44, 16, 45, "HOW TO READ DOT SIZE", "Fraction of PBMC4k cells expressing a marker", "Larger dots mean a greater fraction of cells in that reviewed PBMC4k type express the gene."),
    areaHotspot("pbmc4k-dot-color", 92, 44, 12, 45, "HOW TO READ COLOR", "Average expression", "Darker or warmer color represents higher average expression within a reviewed cell type. Coordinated marker programs matter more than any one dot."),
    areaHotspot("pbmc4k-independent", 48, 46, 64, 68, "INDEPENDENT LABEL CHECK", "Second-donor marker programs", "Canonical T-, B-, NK-, monocyte-, platelet-, and dendritic-cell markers support PBMC4k’s reviewed labels before those labels are compared with model predictions."),
  ],
};

const studySlides: StudySlide[] = [
  {
    id: "dataset",
    number: "01",
    eyebrow: "THE DATASET",
    title: "2,700 cells from our first donor",
    summary:
      "PBMC3k is a single-cell RNA sequencing dataset from one healthy donor. Each cell is represented by counts of RNA—the temporary instructions that cell was using when sampled.",
    notes: [
      { label: "Starting profiles", value: "2,700 cells" },
      { label: "Source", value: "10x Genomics" },
      { label: "Donors", value: "1 healthy person" },
    ],
    points: [
      { term: "PBMC", explanation: "Peripheral blood mononuclear cells include T cells, B cells, NK cells, and monocytes." },
      { term: "scRNA-seq", explanation: "Single-cell RNA sequencing records gene activity separately for every cell instead of averaging the sample." },
      { term: "Goal", explanation: "Recover immune-cell identities, then test whether a classifier can reproduce the reviewed labels." },
    ],
    figures: [
      {
        src: "/figures/classification-class-balance.png",
        alt: "Bar chart showing the final counts of nine reviewed immune-cell types",
        label: "Cell populations",
        caption: "",
      },
      {
        src: "/figures/leiden-clusters.png",
        alt: "UMAP map of 2,638 cells in nine Leiden communities",
        label: "Cell map",
        caption: "Each dot is one cell. Nearby dots have similar RNA profiles; colors show the nine graph communities.",
      },
    ],
  },
  {
    id: "preprocessing",
    number: "02",
    eyebrow: "PREPROCESSING",
    title: "Processing messy data.",
    summary:
      "We used filters to clean data and retain only usable cells.",
    notes: [
      { label: "Retained", value: "2,638 · 97.7%" },
      { label: "Detected genes", value: "200–2,499" },
      { label: "Mitochondrial RNA", value: "< 5%" },
    ],
    points: [
      { term: "QC thresholds", explanation: "Too few genes can indicate a broken droplet; too many can indicate two cells captured together." },
      { term: "Normalization", explanation: "Each cell was scaled to 10,000 total counts and transformed with log1p." },
      { term: "Variable genes", explanation: "The 2,000 most informative genes were used for mapping, while all normalized genes remained available for marker tests." },
    ],
    figures: [
      {
        src: "/figures/qc-retained-cell-distributions.png",
        alt: "Histograms of RNA counts, detected genes, and mitochondrial RNA after quality control",
        label: "QC distributions",
        caption: "Red dashed lines show the gene-count and mitochondrial-RNA filters. Only 62 of 2,700 profiles were removed.",
      },
      {
        src: "/figures/eda-pca-umap.png",
        alt: "PCA variance plot and UMAP after preprocessing",
        label: "Prepared data",
        caption: "After normalization and variable-gene selection, the data contains enough structured variation for mapping.",
      },
    ],
  },
  {
    id: "eda",
    number: "03",
    eyebrow: "EXPLORATORY ANALYSIS",
    title: "Find groups within thousands of cells.",
    summary:
      "We use various methods to simplify data into 2D projections.",
    notes: [
      { label: "PCA dimensions", value: "First 10" },
      { label: "Neighbors per cell", value: "15" },
      { label: "Cross-check", value: "UMAP + t-SNE" },
    ],
    points: [
      { term: "PCA", explanation: "Principal component analysis combines correlated genes into compact summary axes." },
      { term: "Neighbor graph", explanation: "Every cell connects to 15 cells with similar PCA profiles; Leiden later clusters this graph." },
      { term: "Embedding caution", explanation: "UMAP and t-SNE axes have no biological units. Local neighborhoods matter more than exact island positions." },
    ],
    figures: [
      {
        src: "/figures/eda-pca-umap.png",
        alt: "PCA variance curve beside a UMAP of the cell-neighbor graph",
        label: "PCA + UMAP",
        caption: "The first 10 PCs feed the neighbor graph; UMAP draws its local structure in two dimensions.",
      },
      {
        src: "/figures/umap-tsne-comparison.png",
        alt: "UMAP and t-SNE views of the same cells",
        label: "UMAP vs t-SNE",
        caption: "Similar neighborhoods across two nonlinear embeddings make a purely visual artifact less likely.",
      },
    ],
  },
  {
    id: "clustering",
    number: "04",
    eyebrow: "CLUSTERING",
    title: "Finding patterns in the data.",
    summary:
      "We clustered data according to shared gene identities to create cell groups our model can learn from.",
    notes: [
      { label: "K-means tested", value: "K = 2–10" },
      { label: "Leiden resolution", value: "0.5" },
      { label: "Reference groups", value: "9 communities" },
    ],
    points: [
      { term: "K-means", explanation: "Partitions PCA space around geometric centers and requires K to be chosen in advance." },
      { term: "Leiden", explanation: "Finds communities in the neighbor network and can follow irregular local shapes." },
      { term: "Decision rule", explanation: "Elbow, silhouette, stability, size, QC patterns, embeddings, and marker genes were considered together." },
    ],
    figures: [
      {
        src: "/figures/clustering-kmeans-leiden-comparison.png",
        alt: "Side-by-side UMAP comparison of K-means and Leiden labels",
        label: "K-means vs Leiden",
        caption: "K-means captures two broad groups; Leiden separates nine finer communities on the same cell map.",
      },
      {
        src: "/figures/kmeans-k2-k10-diagnostics.png",
        alt: "Elbow and silhouette diagnostics for K equals 2 through 10",
        label: "Choosing K",
        caption: "Silhouette favors K=2 while the elbow appears nearer K=4, showing why no single curve determines the biological answer.",
      },
      {
        src: "/figures/leiden-resolution-diagnostics.png",
        alt: "Diagnostics for Leiden resolutions 0.3 through 0.8",
        label: "Leiden sensitivity",
        caption: "Resolution 0.5 balances cluster count, separation, stability, and technical-quality association.",
      },
    ],
  },
  {
    id: "annotation",
    number: "05",
    eyebrow: "CELL-TYPE ANNOTATION",
    title: "Uncovering cell types.",
    summary:
      "Various tests, known immune signatures, and human review turned nine clusters into nine likely cell types.",
    notes: [
      { label: "Reviewed identities", value: "9 cell types" },
      { label: "Confidence", value: "7 high · 2 moderate" },
      { label: "Rarest label", value: "11 platelets" },
    ],
    points: [
      { term: "Marker program", explanation: "Several lineage-consistent genes are stronger evidence than one highly expressed gene." },
      { term: "Examples", explanation: "CD3D/CD3E support T cells, MS4A1/CD79A B cells, NKG7/GNLY NK cells, and LYZ/LST1 monocytes." },
      { term: "Dominant RNA", explanation: "Stress, mitochondrial, ribosomal, or library-size effects were checked before accepting a label." },
    ],
    figures: [
      {
        src: "/figures/annotation-marker-dotplot.png",
        alt: "Marker-gene dot plot across nine reviewed cell types",
        label: "Marker evidence",
        caption: "Dot size is expression prevalence; color is mean expression. Coordinated columns support each reviewed identity.",
        hotspots: buildMarkerDotplotHotspots(),
      },
      {
        src: "/figures/leiden-clusters.png",
        alt: "Nine numbered Leiden clusters before annotation",
        label: "Before naming",
        caption: "Leiden supplies numbered communities. Marker evidence and review—not UMAP location—supply biological names.",
      },
    ],
  },
  {
    id: "model",
    number: "06",
    eyebrow: "MODEL EVALUATION",
    title: "May the best model win.",
    summary:
      "Evaluating various machine learning methods based on their accuracy in classifying a cell correctly led us to choose a model called XGBoost.",
    notes: [
      { label: "Split", value: "70% · 20% · 10%" },
      { label: "Selected model", value: "XGBoost" },
      { label: "Test accuracy", value: "90.2%" },
    ],
    points: [
      { term: "Nine contenders", explanation: "We tested linear, tree, neural, support-vector, neighbor, and probabilistic model families." },
      { term: "Macro-F1", explanation: "Each cell type receives equal weight, preventing large T-cell groups from hiding rare-class errors." },
      { term: "Limitation", explanation: "All cells came from one donor, so the score measures within-dataset reproducibility—not transfer to a new person." },
    ],
    figures: [
      {
        src: "/figures/classification-model-comparison.png",
        alt: "Validation and test metrics for nine classifiers",
        label: "Model comparison",
        caption: "XGBoost ranked first by the prespecified validation macro-F1. Test results were opened only after selection.",
        hotspots: modelComparisonHotspots,
      },
      {
        src: "/figures/classification-confusion-matrix.png",
        alt: "Normalized confusion matrix for XGBoost test predictions",
        label: "Where errors occur",
        caption: "The diagonal represents correct calls; related T-cell states create the clearest remaining confusion.",
        hotspots: buildConfusionMatrixHotspots(),
      },
      {
        src: "/figures/classification-top-selected-genes.png",
        alt: "Top genes selected using training cells only",
        label: "Training-only features",
        caption: "ANOVA feature selection used training cells only, preventing validation or test information from leaking into the model.",
      },
    ],
  },
  {
    id: "biological-interpretation",
    number: "07",
    eyebrow: "BIOLOGICAL INTERPRETATION",
    title: "Using genes to decide cell function",
    summary:
      "By looking at various genes expressed in cells, we can guess what kind of cell it is and its function.",
    notes: [
      { label: "Markers reviewed", value: "90 entries" },
      { label: "Unique genes", value: "78" },
      { label: "Clusters covered", value: "9 of 9" },
    ],
    points: [
      { term: "Composite ranking", explanation: "Genes rise when they combine a strong fold change with broad within-cluster expression and low expression elsewhere." },
      { term: "Pilot analysis", explanation: "NK cells were the first detailed test: GZMB, FGFBP2, GNLY, PRF1, and NKG7 formed its clearest cytotoxic program." },
      { term: "Composition", explanation: "Counts and percentages always accompany rare populations so an apparently perfect signal is not mistaken for a large sample." },
    ],
    figures: [
      {
        src: "/figures/cluster-percentages.png",
        alt: "Bar chart showing the percentage of PBMC3k cells assigned to each of nine reviewed cell types",
        label: "Population share",
        caption: "IL7R+ memory/helper T cells are the largest group at 22.8%; the platelet population contains 11 cells, or 0.4%.",
      },
      {
        src: "/figures/representative-marker-heatmap.png",
        alt: "Heatmap of representative marker-gene expression across nine PBMC3k clusters",
        label: "Gene programs",
        caption: "Cluster-average expression reveals coordinated programs rather than relying on any single marker gene.",
      },
      {
        src: "/figures/marker-specificity.png",
        alt: "Marker specificity scores for the five strongest representative genes in each cluster",
        label: "Marker specificity",
        caption: "The top five saved representatives per cluster summarize how strongly each gene distinguishes its assigned population.",
      },
    ],
  },
  {
    id: "literature",
    number: "08",
    eyebrow: "LITERATURE VALIDATION",
    title: "Check every grouping against verified scientific evidence.",
    summary:
      "We checked all cells and genes with scientific truth to ensure our information is not misleading.",
    notes: [
      { label: "Verified references", value: "231 rows" },
      { label: "Unique PubMed papers", value: "224" },
      { label: "Coverage", value: "9 clusters" },
    ],
    points: [
      { term: "Evidence grades", explanation: "A and B require repeated human evidence; C reflects laboratory or animal evidence; D is computational; E marks limited support." },
      { term: "Traceable claims", explanation: "Dataset observations, publication findings, and later interpretation remain separate so a citation cannot silently become a conclusion." },
      { term: "Known gap", explanation: "One representative gene in the CD16+ non-classical monocyte cluster had insufficient direct evidence and remains explicitly unresolved." },
    ],
    figures: [
      {
        src: "/figures/evidence-validation-overview.png",
        alt: "Overview of representative genes, verified PubMed evidence, reuse, and validation status across all clusters",
        label: "Evidence audit",
        caption: "Coverage and validation totals are calculated from the saved evidence files; repeated genes reuse the same verified literature.",
      },
      {
        src: "/figures/final-cluster-summary.png",
        alt: "Table of nine clusters with representative markers, annotation support, confidence, and dominant biological program",
        label: "Evidence by cluster",
        caption: "Each population stays connected to its strongest markers, evidence-supported program, confidence, and validation status.",
      },
    ],
  },
  {
    id: "reasoning",
    number: "09",
    eyebrow: "EVIDENCE-GROUNDED REASONING",
    title: "Turn evidence into cautious, testable biological conclusions.",
    summary:
      "We evaluated generated groupings with genes known to be present in cell types. We confidently classified most cell types moderately or highly confidently, and only one cell type with lower confidence.",
    notes: [
      { label: "Reports validated", value: "9 of 9" },
      { label: "Validation failures", value: "0" },
      { label: "Lowest confidence", value: "Activated T cells" },
    ],
    points: [
      { term: "Two confidence layers", explanation: "The earlier 7-high/2-moderate annotation review and the later High/Moderate/Low reasoning confidence answer different questions and are not interchangeable." },
      { term: "Strongest conclusions", explanation: "B-cell receptor identity, inflammatory classical-monocyte markers, and platelet membrane programs have the clearest combined support." },
      { term: "Open questions", explanation: "The NK population may overlap related cytotoxic T, NKT, or gamma-delta T states, and RNA alone cannot establish protein activity." },
    ],
    figures: [
      {
        src: "/figures/biological-reasoning-summary.png",
        alt: "Summary of annotation support, biological reasoning confidence, and validation status for all nine clusters",
        label: "Reasoning confidence",
        caption: "Qualitative categories are preserved as categories—not converted into artificial probabilities.",
      },
      {
        src: "/figures/final-cluster-summary.png",
        alt: "Final cluster summary showing cell types, top markers, support, confidence, and dominant programs",
        label: "Final interpretation",
        caption: "The final table keeps the biological conclusion beside the representative genes and level of uncertainty that support it.",
      },
    ],
  },
  {
    id: "pipeline",
    number: "10",
    eyebrow: "FULL EVIDENCE PIPELINE",
    title: "How did we get here?",
    summary:
      "Our process goes through lengthy processing, training, and external checks to produce our model.",
    notes: [
      { label: "Analysis phases", value: "1–9" },
      { label: "Reasoning validation", value: "9 passed" },
      { label: "Core boundary", value: "RNA ≠ function" },
    ],
    points: [
      { term: "Provenance", explanation: "Every conclusion can be traced backward from the final report to literature evidence, marker statistics, reviewed labels, and the processed cells." },
      { term: "No diagnosis", explanation: "The study cannot infer disease, identity, race, ethnicity, or personality from this donor's cluster assignments." },
      { term: "Generalization", explanation: "A second donor is a useful transfer test, but larger independently processed cohorts are still needed before clinical or population-level claims." },
    ],
    figures: [
      {
        src: "/figures/complete-analysis-pipeline.png",
        alt: "Complete PBMC workflow from data loading through computational analysis, literature integration, reasoning, and validation",
        label: "End-to-end provenance",
        caption: "Computational analysis, literature evidence, biological interpretation, and validation remain visibly separate stages.",
      },
      {
        src: "/figures/cluster-cell-counts.png",
        alt: "Counts of cells in each of the nine final PBMC3k populations",
        label: "Sample-size context",
        caption: "Every biological claim should be read alongside its sample size, especially the 11-cell platelet population.",
      },
    ],
  },
  {
    id: "second-donor",
    number: "11",
    eyebrow: "SECOND DONOR",
    title: "Does this model work on someone else?",
    summary:
      "The dataset PBMC4k comes from a second healthy donor. We used it as a testing set to see if our model works on others - check our results on both datasets on the next slide!",
    notes: [
      { label: "Starting profiles", value: "4,340 cells" },
      { label: "Final singlets", value: "4,131 cells" },
      { label: "Reviewed identities", value: "9 cell types" },
    ],
    points: [
      { term: "Independent review", explanation: "PBMC4k cell identities came from its own clusters and marker genes—not from the PBMC3k model's predictions." },
      { term: "External donor", explanation: "Because XGBoost learned only from PBMC3k, PBMC4k tests whether its learned patterns transfer to a different person." },
      { term: "Broad result", explanation: "After related T-cell states were combined into six broad categories, the model agreed with 95.9% of 4,097 supported PBMC4k cells. The 34 dendritic cells remained reviewed annotations outside the model." },
    ],
    figures: [
      {
        src: "/figures/pbmc4k-reviewed-annotations-umap.png",
        alt: "PBMC4k Leiden clusters beside independently reviewed PBMC4k cell-type annotations",
        label: "Second-donor map",
        caption: "PBMC4k was clustered and labeled from its own expression patterns before it was used to evaluate the PBMC3k-trained model.",
      },
      {
        src: "/figures/pbmc4k-marker-validation.png",
        alt: "Dot plot validating reviewed PBMC4k cell types with immune marker genes",
        label: "Independent markers",
        caption: "Known immune-gene programs support the second donor's reviewed labels, providing a comparison target independent of XGBoost.",
      },
    ],
  },
];

function Mark() {
  return <span className="onepage-mark" aria-hidden="true"><i /><i /><i /></span>;
}

type FigureView = { scale: number; x: number; y: number };
type FigurePoint = { x: number; y: number };
type FigureImageLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

const MIN_FIGURE_SCALE = 1;
const MAX_FIGURE_SCALE = 6;

function InteractiveFigure({ figure }: { figure: Figure }) {
  const hotspots = figure.hotspots ?? figureHotspotsBySource[figure.src];
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, FigurePoint>());
  const gestureMovedRef = useRef(false);
  const tapHotspotRef = useRef<string | null>(null);
  const dragRef = useRef<{ pointer: FigurePoint; view: FigureView } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    midpoint: FigurePoint;
    view: FigureView;
  } | null>(null);
  const viewRef = useRef<FigureView>({ scale: 1, x: 0, y: 0 });
  const [view, setView] = useState<FigureView>(viewRef.current);
  const [hover, setHover] = useState<FigurePoint | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [imageLayout, setImageLayout] = useState<FigureImageLayout | null>(null);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [pinnedHotspotId, setPinnedHotspotId] = useState<string | null>(null);

  const activeHotspot = hotspots?.find((hotspot) => hotspot.id === activeHotspotId) ?? null;

  const updateImageLayout = () => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image?.naturalWidth || !image.naturalHeight) return;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const viewportAspect = viewportWidth / Math.max(viewportHeight, 1);
    const width = viewportAspect > imageAspect ? viewportHeight * imageAspect : viewportWidth;
    const height = viewportAspect > imageAspect ? viewportHeight : viewportWidth / imageAspect;
    setImageLayout({
      left: (viewportWidth - width) / 2,
      top: (viewportHeight - height) / 2,
      width,
      height,
      viewportWidth,
      viewportHeight,
    });
  };

  const commitView = (next: FigureView) => {
    const viewport = viewportRef.current;
    const scale = Math.min(MAX_FIGURE_SCALE, Math.max(MIN_FIGURE_SCALE, next.scale));
    if (!viewport || scale === MIN_FIGURE_SCALE) {
      viewRef.current = { scale, x: 0, y: 0 };
      setView(viewRef.current);
      return;
    }
    const bounds = viewport.getBoundingClientRect();
    const maxX = bounds.width * (scale - 1) / 2;
    const maxY = bounds.height * (scale - 1) / 2;
    viewRef.current = {
      scale,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
    setView(viewRef.current);
  };

  const zoomAt = (requestedScale: number, clientPoint?: FigurePoint) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = viewRef.current;
    const scale = Math.min(MAX_FIGURE_SCALE, Math.max(MIN_FIGURE_SCALE, requestedScale));
    if (scale === current.scale) return;
    const bounds = viewport.getBoundingClientRect();
    const focal = clientPoint
      ? { x: clientPoint.x - bounds.left - bounds.width / 2, y: clientPoint.y - bounds.top - bounds.height / 2 }
      : { x: 0, y: 0 };
    const ratio = scale / current.scale;
    commitView({
      scale,
      x: focal.x - (focal.x - current.x) * ratio,
      y: focal.y - (focal.y - current.y) * ratio,
    });
  };

  const updateHover = (clientX: number, clientY: number) => {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHover({
      x: Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100)),
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".figure-tools")) return;
    gestureMovedRef.current = false;
    tapHotspotRef.current =
      (event.target as HTMLElement).closest<HTMLElement>(".figure-hotspot")?.dataset.hotspotId ?? null;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointer: { x: event.clientX, y: event.clientY },
        view: { ...viewRef.current },
      };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        view: { ...viewRef.current },
      };
      dragRef.current = null;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") updateHover(event.clientX, event.clientY);
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      event.preventDefault();
      gestureMovedRef.current = true;
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const start = pinchRef.current;
      const scale = Math.min(
        MAX_FIGURE_SCALE,
        Math.max(MIN_FIGURE_SCALE, start.view.scale * distance / Math.max(start.distance, 1)),
      );
      const bounds = viewportRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const startFocal = {
        x: start.midpoint.x - bounds.left - bounds.width / 2,
        y: start.midpoint.y - bounds.top - bounds.height / 2,
      };
      const currentFocal = {
        x: midpoint.x - bounds.left - bounds.width / 2,
        y: midpoint.y - bounds.top - bounds.height / 2,
      };
      const ratio = scale / start.view.scale;
      commitView({
        scale,
        x: currentFocal.x - (startFocal.x - start.view.x) * ratio,
        y: currentFocal.y - (startFocal.y - start.view.y) * ratio,
      });
      return;
    }

    if (pointersRef.current.size === 1 && dragRef.current && viewRef.current.scale > 1) {
      event.preventDefault();
      if (
        Math.hypot(
          event.clientX - dragRef.current.pointer.x,
          event.clientY - dragRef.current.pointer.y,
        ) > 5
      ) {
        gestureMovedRef.current = true;
      }
      commitView({
        ...dragRef.current.view,
        x: dragRef.current.view.x + event.clientX - dragRef.current.pointer.x,
        y: dragRef.current.view.y + event.clientY - dragRef.current.pointer.y,
      });
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const completesGesture = pointersRef.current.size === 1;
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pinchRef.current = null;
    const remaining = [...pointersRef.current.values()][0];
    dragRef.current = remaining ? { pointer: remaining, view: { ...viewRef.current } } : null;
    if (completesGesture && !gestureMovedRef.current && tapHotspotRef.current) {
      const hotspotId = tapHotspotRef.current;
      const nextPinned = pinnedHotspotId === hotspotId ? null : hotspotId;
      setPinnedHotspotId(nextPinned);
      setActiveHotspotId(nextPinned);
    }
    if (completesGesture) tapHotspotRef.current = null;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.002);
    zoomAt(viewRef.current.scale * factor, { x: event.clientX, y: event.clientY });
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".figure-tools, .figure-hotspot")) return;
    zoomAt(viewRef.current.scale > 1 ? 1 : 2.5, { x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && expanded) setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(updateImageLayout);
    observer.observe(viewport);
    updateImageLayout();
    return () => observer.disconnect();
  }, [expanded]);

  const hotspotPosition = activeHotspot && imageLayout
    ? (() => {
        const baseX = imageLayout.left + imageLayout.width * activeHotspot.x / 100;
        const baseY = imageLayout.top + imageLayout.height * activeHotspot.y / 100;
        const centerX = imageLayout.viewportWidth / 2;
        const centerY = imageLayout.viewportHeight / 2;
        return {
          x: centerX + view.x + view.scale * (baseX - centerX),
          y: centerY + view.y + view.scale * (baseY - centerY),
        };
      })()
    : null;

  return (
    <figure className={expanded ? "interactive-figure is-expanded" : "interactive-figure"}>
      <div
        className={view.scale > 1 ? "figure-viewport is-zoomed" : "figure-viewport"}
        ref={viewportRef}
        tabIndex={0}
        role="application"
        aria-label={`Interactive view of ${figure.label}. Use the mouse wheel or pinch to zoom, and drag to pan.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && pointersRef.current.size === 0) setHover(null);
        }}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoomAt(viewRef.current.scale * 1.35);
          } else if (event.key === "-") {
            event.preventDefault();
            zoomAt(viewRef.current.scale / 1.35);
          } else if (event.key === "0") {
            event.preventDefault();
            commitView({ scale: 1, x: 0, y: 0 });
          }
        }}
      >
        <img
          ref={imageRef}
          src={withBasePath(figure.src)}
          alt={figure.alt}
          draggable={false}
          onLoad={updateImageLayout}
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        />
        {hotspots && imageLayout && (
          <div
            className="figure-hotspot-layer"
            aria-label="Interactive graph explanations"
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
          >
            {hotspots.map((hotspot) => (
              <button
                className={`figure-hotspot ${hotspot.width ? "is-area" : "is-point"} ${activeHotspotId === hotspot.id ? "is-active" : ""}`}
                key={hotspot.id}
                type="button"
                data-hotspot-id={hotspot.id}
                style={{
                  left: imageLayout.left + imageLayout.width * hotspot.x / 100,
                  top: imageLayout.top + imageLayout.height * hotspot.y / 100,
                  width: hotspot.width ? imageLayout.width * hotspot.width / 100 : undefined,
                  height: hotspot.height ? imageLayout.height * hotspot.height / 100 : undefined,
                }}
                aria-label={`${hotspot.title}. ${hotspot.explanation}`}
                aria-pressed={pinnedHotspotId === hotspot.id}
                onMouseEnter={() => setActiveHotspotId(hotspot.id)}
                onMouseLeave={() => {
                  if (pinnedHotspotId !== hotspot.id) setActiveHotspotId(null);
                }}
                onFocus={() => setActiveHotspotId(hotspot.id)}
                onBlur={() => {
                  if (pinnedHotspotId !== hotspot.id) setActiveHotspotId(null);
                }}
                onClick={(event) => {
                  if (event.detail !== 0) return;
                  const nextPinned = pinnedHotspotId === hotspot.id ? null : hotspot.id;
                  setPinnedHotspotId(nextPinned);
                  setActiveHotspotId(nextPinned);
                }}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {activeHotspot && hotspotPosition && imageLayout && (
          <aside
            className={`figure-tooltip ${hotspotPosition.x > imageLayout.viewportWidth * 0.58 ? "align-right" : ""} ${hotspotPosition.y > imageLayout.viewportHeight * 0.68 ? "align-bottom" : ""}`}
            style={{
              left: Math.max(10, Math.min(imageLayout.viewportWidth - 10, hotspotPosition.x)),
              top: Math.max(10, Math.min(imageLayout.viewportHeight - 10, hotspotPosition.y)),
            }}
            role="tooltip"
          >
            <span>{activeHotspot.kicker}</span>
            <strong>{activeHotspot.title}</strong>
            <p>{activeHotspot.explanation}</p>
            <small>{pinnedHotspotId === activeHotspot.id ? "Pinned · tap again to close" : "Tap to pin this explanation"}</small>
          </aside>
        )}
        <div className="figure-tools" aria-label="Figure controls">
          <button type="button" onClick={() => zoomAt(view.scale * 1.35)} aria-label="Zoom in" title="Zoom in">+</button>
          <button type="button" onClick={() => zoomAt(view.scale / 1.35)} aria-label="Zoom out" title="Zoom out">−</button>
          <button
            type="button"
            onClick={() => commitView({ scale: 1, x: 0, y: 0 })}
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            1×
          </button>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-label={expanded ? "Close expanded figure" : "Expand figure"}
            title={expanded ? "Close expanded figure" : "Expand figure"}
          >
            {expanded ? "×" : "↗"}
          </button>
        </div>
        <div className="figure-interaction-hint" aria-hidden="true">
          {hotspots
            ? "Hover or tap data marks for meaning · pinch to zoom"
            : hover
            ? `${hover.x.toFixed(0)}% × ${hover.y.toFixed(0)}% · ${view.scale.toFixed(1)}×`
            : "Scroll or pinch to zoom · drag to pan"}
        </div>
      </div>
      {activeHotspot && (
        <aside className="figure-mobile-explanation" aria-live="polite">
          <button
            type="button"
            onClick={() => {
              setPinnedHotspotId(null);
              setActiveHotspotId(null);
            }}
            aria-label="Close graph explanation"
          >
            ×
          </button>
          <span>{activeHotspot.kicker}</span>
          <strong>{activeHotspot.title}</strong>
          <p>{activeHotspot.explanation}</p>
          <small>Tap another highlighted area to explore more.</small>
        </aside>
      )}
      <figcaption><strong>{figure.label}</strong><span>{figure.caption}</span></figcaption>
    </figure>
  );
}

function FigureViewer({ figures }: { figures: Figure[] }) {
  const [active, setActive] = useState(0);
  const figure = figures[active];
  useEffect(() => setActive(0), [figures]);
  return (
    <div className="slide-visual">
      <div className="slide-figure-tabs" role="tablist" aria-label="Figures on this slide">
        {figures.map((item, index) => (
          <button key={item.label} role="tab" aria-selected={active === index} className={active === index ? "active" : ""} onClick={() => setActive(index)}>
            <span>0{index + 1}</span>{item.label}
          </button>
        ))}
      </div>
      <InteractiveFigure figure={figure} key={figure.src} />
    </div>
  );
}

function MethodSlide({ slide }: { slide: StudySlide }) {
  const summaryLines = slide.summary.split(/(?<=[.!?])\s+/);
  return (
    <div className="study-card">
      <header className="study-card-header">
        <h1>{slide.title}</h1>
      </header>
      <div className="study-card-body">
        <div className="slide-copy">
          <div className="slide-summary" aria-label={slide.summary}>
            {summaryLines.map((line, index) => (
              <p key={line}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {line}
              </p>
            ))}
          </div>
        </div>
        <FigureViewer figures={slide.figures} />
      </div>
    </div>
  );
}

function ModelTester() {
  const [payloads, setPayloads] = useState<Record<DatasetKey, PredictionPayload> | null>(null);
  const [dataset, setDataset] = useState<DatasetKey>("pbmc3k");
  const [query, setQuery] = useState("42");
  const [selected, setSelected] = useState<CellPrediction | null>(null);
  const [error, setError] = useState("");
  const data = payloads?.[dataset] ?? null;

  useEffect(() => {
    let active = true;
    Promise.all(
      (Object.entries(modelDatasets) as [DatasetKey, (typeof modelDatasets)[DatasetKey]][])
        .map(async ([key, config]) => {
          const response = await fetch(withBasePath(config.url));
          if (!response.ok) throw new Error("Prediction data unavailable");
          return [key, await response.json() as PredictionPayload] as const;
        }),
    )
      .then((entries) => {
        if (!active) return;
        const loaded = Object.fromEntries(entries) as Record<DatasetKey, PredictionPayload>;
        setPayloads(loaded);
        setSelected(loaded.pbmc3k.cells[41]);
      })
      .catch(() => active && setError("Prediction data could not be loaded."));
    return () => { active = false; };
  }, []);

  const topProbabilities = useMemo(() => {
    if (!data || !selected || selected.annotation_only) return [];
    return data.classes
      .map((name, index) => ({ name, value: selected.probabilities[index] }))
      .filter(({ value }) => Number((value * 100).toFixed(1)) > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, selected]);

  const selectCell = (cell: CellPrediction) => {
    setSelected(cell);
    setQuery(String(cell.number));
    setError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    const trimmed = query.trim();
    const cell = /^\d+$/.test(trimmed)
      ? data.cells[Number(trimmed) - 1]
      : data.cells.find((item) =>
          item.barcode.toUpperCase() === trimmed.toUpperCase()
          || item.cell_id?.toUpperCase() === trimmed.toUpperCase()
        );
    if (!cell) {
      setError(`Enter a cell from 1 to ${data.cell_count.toLocaleString()} or a complete barcode.`);
      return;
    }
    selectCell(cell);
  };

  const randomCell = () => {
    if (!data) return;
    selectCell(data.cells[Math.floor(Math.random() * data.cells.length)]);
  };

  const changeDataset = (nextDataset: DatasetKey) => {
    if (!payloads) return;
    setDataset(nextDataset);
    setSelected(null);
    setQuery("");
    setError("");
  };

  const annotationOnly = Boolean(selected?.annotation_only);
  const splitLabel = selected?.split === "test"
    ? "untouched test"
    : selected?.split === "external"
      ? "external test"
      : selected?.split;

  return (
    <div className="study-card test-card">
      <header className="study-card-header">
        <h1>Try it: can our model guess your cell type?</h1>
      </header>
      <div className="model-test-body">
        <form onSubmit={submit}>
          <div className="model-dataset-switch" role="group" aria-label="Choose a dataset">
            {(Object.keys(modelDatasets) as DatasetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={dataset === key ? "is-active" : ""}
                aria-pressed={dataset === key}
                onClick={() => changeDataset(key)}
                disabled={!payloads}
              >
                {modelDatasets[key].label}
              </button>
            ))}
          </div>
          <h2>Enter a cell number</h2>
          <p>{modelDatasets[dataset].description} This lookup does not process new sequencing files.</p>
          <label htmlFor="homepage-cell">Cell number or barcode</label>
          <div className="model-test-input">
            <input id="homepage-cell" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 42" disabled={!data} />
            <button type="submit" disabled={!data}>Predict <span>→</span></button>
          </div>
          <button className="random-cell" type="button" onClick={randomCell} disabled={!data}>Pick a random cell</button>
          {error && <p className="model-test-error" role="alert">{error}</p>}
        </form>
        <article className="prediction-result" aria-live="polite">
          {selected && data ? (
            <>
              <div className="prediction-heading">
                <div><span>{annotationOnly ? "REVIEWED ANNOTATION" : "XGBOOST PREDICTS"}</span><h2>{selected.predicted}</h2></div>
                {!annotationOnly && selected.confidence !== null && (
                  <strong>{(selected.confidence * 100).toFixed(1)}%<small>confidence</small></strong>
                )}
              </div>
              <p className={annotationOnly || selected.predicted === selected.reviewed ? "prediction-match" : "prediction-different"}>
                {annotationOnly
                  ? <>Marker review identifies this cell as <b>Dendritic cells</b>; this is not an XGBoost prediction.</>
                  : <>{selected.predicted === selected.reviewed ? "Matches" : "Differs from"} reviewed label: <b>{selected.reviewed}</b></>}
              </p>
              {!annotationOnly && (
                <div className="top-probabilities">
                  {topProbabilities.map(({ name, value }) => (
                    <div key={name}><p><span>{name}</span><strong>{(value * 100).toFixed(1)}%</strong></p><i><b style={{ width: `${value * 100}%` }} /></i></div>
                  ))}
                </div>
              )}
              <small>
                Cell {selected.number.toLocaleString()} · {splitLabel} split.{" "}
                {annotationOnly
                  ? "This result comes from reviewed PBMC4k marker annotation because dendritic cells are outside the model’s six-class scope."
                  : dataset === "pbmc4k"
                    ? "This donor was external to training; the PBMC3k-trained probabilities are combined into six broad categories. Model confidence is not biological certainty."
                    : "Model confidence is not biological certainty."}
              </small>
            </>
          ) : <p>{data ? `Choose a ${modelDatasets[dataset].label} cell to see its result.` : "Loading saved model predictions…"}</p>}
        </article>
      </div>
    </div>
  );
}

function ScrollTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="scroll-tutorial-backdrop">
      <section className="scroll-tutorial" role="dialog" aria-modal="true" aria-labelledby="scroll-tutorial-title">
        <button onClick={onClose} aria-label="Close tutorial">×</button>
        <span>HOW TO EXPLORE</span>
        <div className="scroll-gesture" aria-hidden="true"><i>←</i><b>→</b></div>
        <h2 id="scroll-tutorial-title">Use the arrows to move through the presentation.</h2>
        <p>Scrolling will not change slides. Captions on interactive graphs are provided for further review, but not necessary for understanding the project.</p>
        <button className="start-scroll" onClick={onClose}>Start at the question <span>→</span></button>
      </section>
    </div>
  );
}

function DnaEntranceCanvas({ unwinding, onComplete }: { unwinding: boolean; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const completionRef = useRef(onComplete);

  useEffect(() => { completionRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 520 : 1850;
    const particles = Array.from({ length: 42 }, (_, index) => ({
      x: (Math.sin(index * 91.7) + 1) / 2,
      y: (Math.sin(index * 47.3 + 1.8) + 1) / 2,
      radius: 1.5 + ((index * 13) % 8) / 3,
      alpha: .12 + ((index * 7) % 9) / 28,
    }));
    let animationFrame = 0;
    let startTime: number | null = null;
    let previousTime = performance.now();
    let finished = false;
    let width = 0;
    let height = 0;

    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const smooth = (value: number) => {
      const bounded = clamp(value);
      return bounded * bounded * (3 - 2 * bounded);
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawFrame = (time: number) => {
      if (unwinding && startTime === null) startTime = time;
      const progress = startTime === null ? 0 : clamp((time - startTime) / duration);
      const delta = Math.min(32, time - previousTime);
      previousTime = time;
      phaseRef.current += delta * .00062 * (1 - progress * .72);

      context.clearRect(0, 0, width, height);
      const backgroundAlpha = 1 - smooth((progress - .04) / .83);
      context.save();
      context.globalAlpha = backgroundAlpha;
      const aura = context.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, Math.max(width, height) * .52);
      aura.addColorStop(0, "rgba(255,255,255,.36)");
      aura.addColorStop(.42, "rgba(203,233,247,.14)");
      aura.addColorStop(1, "rgba(83,151,198,0)");
      context.fillStyle = aura;
      context.fillRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        const drift = Math.sin(time * .00035 + index) * 5;
        context.beginPath();
        context.arc(particle.x * width + drift, particle.y * height, particle.radius, 0, Math.PI * 2);
        context.fillStyle = index % 4 === 0
          ? `rgba(255,255,255,${particle.alpha})`
          : `rgba(78,158,207,${particle.alpha})`;
        context.fill();
      });
      context.restore();

      const helixHeight = Math.min(height * .86, 820);
      const top = (height - helixHeight) / 2;
      const center = width / 2;
      const amplitude = Math.min(width * .14, 136);
      const turns = 6;
      const edgePadding = Math.max(2, width * .004);
      const sectionProgress = (u: number) => smooth((progress - u * .55) / .45);
      const point = (u: number, strand: number) => {
        const local = sectionProgress(u);
        const angle = u * turns * Math.PI * 2 + phaseRef.current + strand * Math.PI;
        const helixX = center + Math.sin(angle) * amplitude;
        const edgeX = strand === 0 ? edgePadding : width - edgePadding;
        return {
          x: helixX + (edgeX - helixX) * local,
          y: top + u * helixHeight,
          depth: (Math.cos(angle) + 1) / 2,
          local,
        };
      };
      const strandAlpha = 1 - smooth((progress - .9) / .1);
      const basePairs = [
        { leftColor: "rgba(22,143,208,.74)", rightColor: "rgba(129,222,238,.66)", leftGlow: "rgba(91,205,240,.9)", rightGlow: "rgba(215,248,255,.96)" },
        { leftColor: "rgba(84,199,232,.7)", rightColor: "rgba(240,221,186,.64)", leftGlow: "rgba(181,241,251,.94)", rightGlow: "rgba(255,248,233,.96)" },
        { leftColor: "rgba(47,115,186,.72)", rightColor: "rgba(156,229,239,.66)", leftGlow: "rgba(114,188,232,.92)", rightGlow: "rgba(227,251,255,.96)" },
        { leftColor: "rgba(105,214,231,.7)", rightColor: "rgba(77,150,209,.72)", leftGlow: "rgba(214,249,255,.96)", rightGlow: "rgba(158,216,242,.92)" },
      ];

      context.save();
      context.globalAlpha = strandAlpha;
      for (let index = 0; index < 30; index += 1) {
        const u = (index + .5) / 30;
        const left = point(u, 0);
        const right = point(u, 1);
        const pair = basePairs[index % basePairs.length];
        const pairAlpha = Math.pow(1 - Math.max(left.local, right.local), 1.45) * .72;
        if (pairAlpha <= .01) continue;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const unitX = dx / Math.max(distance, 1);
        const unitY = dy / Math.max(distance, 1);
        const innerGap = Math.min(16, distance * .1);
        const baseLength = Math.max(7, (distance - innerGap) / 2);
        const baseHeight = Math.max(8, Math.min(13, helixHeight / 58));
        context.globalAlpha = strandAlpha * pairAlpha;

        const rungGradient = context.createLinearGradient(left.x, left.y, right.x, right.y);
        rungGradient.addColorStop(0, "rgba(72,172,220,.72)");
        rungGradient.addColorStop(.45, "rgba(231,249,255,.92)");
        rungGradient.addColorStop(.55, "rgba(255,251,238,.94)");
        rungGradient.addColorStop(1, "rgba(82,183,220,.7)");
        context.strokeStyle = rungGradient;
        context.lineWidth = 9;
        context.lineCap = "round";
        context.shadowColor = "rgba(70,181,226,.58)";
        context.shadowBlur = 15;
        context.beginPath();
        context.moveTo(left.x, left.y);
        context.lineTo(right.x, right.y);
        context.stroke();
        context.shadowBlur = 0;

        context.globalAlpha = strandAlpha * pairAlpha * .72;
        context.strokeStyle = "rgba(255,255,255,.96)";
        context.lineWidth = 1.35;
        context.beginPath();
        context.moveTo(left.x - unitY * 2.2, left.y + unitX * 2.2);
        context.lineTo(right.x - unitY * 2.2, right.y + unitX * 2.2);
        context.stroke();
        context.globalAlpha = strandAlpha * pairAlpha;

        const drawBase = (
          startX: number,
          startY: number,
          color: string,
          glowColor: string,
          reverse: boolean,
        ) => {
          context.save();
          context.translate(startX, startY);
          context.rotate(angle);
          const x = reverse ? -baseLength : 0;
          const baseGradient = context.createLinearGradient(x, -baseHeight / 2, x + baseLength, baseHeight / 2);
          baseGradient.addColorStop(0, color);
          baseGradient.addColorStop(.3, glowColor);
          baseGradient.addColorStop(.68, color);
          baseGradient.addColorStop(1, "rgba(244,252,255,.88)");
          context.fillStyle = baseGradient;
          context.shadowColor = glowColor;
          context.shadowBlur = 10;
          context.beginPath();
          context.roundRect(x, -baseHeight / 2, baseLength, baseHeight, baseHeight / 2);
          context.fill();
          context.shadowBlur = 0;
          context.strokeStyle = "rgba(255,255,255,.78)";
          context.lineWidth = 1.15;
          context.stroke();
          context.strokeStyle = "rgba(255,255,255,.62)";
          context.lineWidth = .9;
          context.beginPath();
          context.moveTo(x + 3, -baseHeight * .2);
          context.lineTo(x + baseLength - 3, -baseHeight * .2);
          context.stroke();
          context.restore();
        };

        const midpointX = left.x + dx * .5;
        const midpointY = left.y + dy * .5;
        drawBase(left.x, left.y, pair.leftColor, pair.leftGlow, false);
        drawBase(right.x, right.y, pair.rightColor, pair.rightGlow, true);

        const bondCount = index % 2 === 0 ? 2 : 3;
        context.fillStyle = "rgba(255,255,255,.96)";
        context.shadowColor = index % 4 === 1 ? "rgba(255,235,196,.9)" : "rgba(111,214,242,.9)";
        context.shadowBlur = 7;
        for (let bond = 0; bond < bondCount; bond += 1) {
          const offset = (bond - (bondCount - 1) / 2) * 4.1;
          context.beginPath();
          context.arc(midpointX + unitX * offset, midpointY + unitY * offset, 1.15, 0, Math.PI * 2);
          context.fill();
        }
        context.shadowBlur = 0;
        [left, right].forEach((node, nodeIndex) => {
          const radius = 2.8 + node.depth * 2.1;
          const nodeGradient = context.createRadialGradient(
            node.x - radius * .35,
            node.y - radius * .4,
            .2,
            node.x,
            node.y,
            radius,
          );
          nodeGradient.addColorStop(0, "rgba(255,255,255,.98)");
          nodeGradient.addColorStop(.34, nodeIndex === 0 ? "rgba(115,225,242,.96)" : "rgba(179,231,250,.96)");
          nodeGradient.addColorStop(1, nodeIndex === 0 ? "rgba(24,131,194,.9)" : "rgba(52,119,185,.88)");
          context.beginPath();
          context.arc(node.x, node.y, radius, 0, Math.PI * 2);
          context.fillStyle = nodeGradient;
          context.shadowColor = "rgba(89,196,230,.75)";
          context.shadowBlur = 10;
          context.fill();
          context.shadowBlur = 0;
        });
      }

      [0, 1].forEach((strand) => {
        const gradient = context.createLinearGradient(center - amplitude, top, center + amplitude, top + helixHeight);
        if (strand === 0) {
          gradient.addColorStop(0, "rgba(225,250,255,.88)");
          gradient.addColorStop(.18, "rgba(92,210,235,.74)");
          gradient.addColorStop(.38, "rgba(32,119,186,.82)");
          gradient.addColorStop(.56, "rgba(195,242,252,.76)");
          gradient.addColorStop(.76, "rgba(42,151,207,.82)");
          gradient.addColorStop(1, "rgba(20,89,158,.78)");
        } else {
          gradient.addColorStop(0, "rgba(248,254,255,.92)");
          gradient.addColorStop(.2, "rgba(153,224,241,.7)");
          gradient.addColorStop(.4, "rgba(70,144,205,.8)");
          gradient.addColorStop(.58, "rgba(222,249,255,.8)");
          gradient.addColorStop(.8, "rgba(105,199,229,.76)");
          gradient.addColorStop(1, "rgba(67,112,185,.8)");
        }
        context.globalAlpha = strandAlpha * .2;
        context.strokeStyle = gradient;
        context.lineWidth = 28;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.shadowColor = "rgba(73,178,222,.48)";
        context.shadowBlur = 26;
        context.beginPath();
        for (let sample = 0; sample <= 280; sample += 1) {
          const current = point(sample / 280, strand);
          if (sample === 0) context.moveTo(current.x, current.y);
          else context.lineTo(current.x, current.y);
        }
        context.stroke();
        context.globalAlpha = strandAlpha * .78;
        context.lineWidth = 11;
        context.shadowBlur = 12;
        context.beginPath();
        for (let sample = 0; sample <= 280; sample += 1) {
          const current = point(sample / 280, strand);
          if (sample === 0) context.moveTo(current.x, current.y);
          else context.lineTo(current.x, current.y);
        }
        context.stroke();

        context.globalAlpha = strandAlpha * .7;
        context.strokeStyle = strand === 0
          ? "rgba(224,250,255,.8)"
          : "rgba(246,253,255,.84)";
        context.lineWidth = 2.1;
        context.shadowColor = "rgba(255,255,255,.82)";
        context.shadowBlur = 5;
        context.beginPath();
        for (let sample = 0; sample <= 280; sample += 1) {
          const current = point(sample / 280, strand);
          const highlightOffset = strand === 0 ? -2.4 : 2.4;
          if (sample === 0) context.moveTo(current.x + highlightOffset, current.y);
          else context.lineTo(current.x + highlightOffset, current.y);
        }
        context.stroke();
        context.shadowBlur = 0;

        for (let sparkle = 0; sparkle < 24; sparkle += 1) {
          const u = (sparkle + .35) / 24;
          const current = point(u, strand);
          const radius = 1.2 + ((sparkle + strand) % 4) * .48;
          const sparkleGradient = context.createRadialGradient(
            current.x - radius * .3,
            current.y - radius * .3,
            .1,
            current.x,
            current.y,
            radius,
          );
          sparkleGradient.addColorStop(0, "rgba(255,255,255,.98)");
          sparkleGradient.addColorStop(.45, "rgba(203,244,252,.78)");
          sparkleGradient.addColorStop(1, "rgba(65,169,218,0)");
          context.globalAlpha = strandAlpha * (.45 + current.depth * .45);
          context.fillStyle = sparkleGradient;
          context.beginPath();
          context.arc(current.x, current.y, radius, 0, Math.PI * 2);
          context.fill();
        }
      });
      context.restore();

      if (unwinding && progress > .04 && progress < .96) {
        const frontY = top + smooth(progress) * helixHeight;
        const front = context.createLinearGradient(center - amplitude * 1.5, frontY, center + amplitude * 1.5, frontY);
        front.addColorStop(0, "rgba(255,255,255,0)");
        front.addColorStop(.5, "rgba(255,255,255,.95)");
        front.addColorStop(1, "rgba(255,255,255,0)");
        context.strokeStyle = front;
        context.lineWidth = 3;
        context.shadowColor = "rgba(73,195,232,.85)";
        context.shadowBlur = 16;
        context.beginPath();
        context.moveTo(center - amplitude * 1.5, frontY);
        context.lineTo(center + amplitude * 1.5, frontY);
        context.stroke();
      }

      if (progress >= 1) {
        if (!finished) {
          finished = true;
          completionRef.current();
        }
        return;
      }
      animationFrame = requestAnimationFrame(drawFrame);
    };
    animationFrame = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [unwinding]);

  return <canvas className="dna-animation-canvas" ref={canvasRef} aria-hidden="true" />;
}

export default function SinglePagePresentation() {
  const presentationSlideCount = studySlides.length + 2;
  const lastSlideIndex = presentationSlideCount - 1;
  const scroller = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const touchStartY = useRef(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [entryState, setEntryState] = useState<"ready" | "unwinding" | "entered">("ready");

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.slide);
        if (!Number.isNaN(index)) setActiveSlide(index);
      },
      { root, threshold: [0.45, 0.65, 0.85] },
    );
    slideRefs.current.forEach((slide) => slide && observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  const closeTutorial = () => {
    try { window.localStorage.setItem("pbmc3k-scroll-tour-v1", "yes"); } catch {}
    setTutorialOpen(false);
  };
  const goToSlide = (index: number) => {
    const root = scroller.current;
    if (!root || index < 0 || index > lastSlideIndex) return;
    setActiveSlide(index);
    root.scrollTo({ left: index * root.clientWidth, behavior: "smooth" });
  };
  const unwindIntoSite = () => {
    if (entryState !== "ready") return;
    setEntryState("unwinding");
  };

  useEffect(() => {
    if (entryState !== "entered" || tutorialOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const nextSlide = event.key === "ArrowLeft"
        ? Math.max(0, activeSlide - 1)
        : Math.min(lastSlideIndex, activeSlide + 1);
      if (nextSlide === activeSlide) return;
      const root = scroller.current;
      if (!root) return;
      setActiveSlide(nextSlide);
      root.scrollTo({ left: nextSlide * root.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlide, entryState, tutorialOpen, lastSlideIndex]);

  const siteStyle = {
    "--dna-background-image": `url("${withBasePath("/figures/dna-loading-background.png")}")`,
  } as CSSProperties;

  return (
    <div
      className={`single-page-site ${entryState !== "ready" ? "is-revealing" : ""} ${entryState === "entered" ? "is-entered" : ""}`}
      style={siteStyle}
    >
      {entryState !== "entered" && (
        <section
          className={`dna-entry ${entryState === "unwinding" ? "unwinding" : ""}`}
          aria-label="Scroll down to unwind the DNA and enter the PBMC3k study"
          onWheel={(event) => {
            if (event.deltaY > 0) {
              event.preventDefault();
              unwindIntoSite();
            }
          }}
          onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? 0; }}
          onTouchMove={(event) => {
            const currentY = event.touches[0]?.clientY ?? touchStartY.current;
            if (touchStartY.current - currentY > 30) unwindIntoSite();
          }}
        >
          <DnaEntranceCanvas unwinding={entryState === "unwinding"} onComplete={() => setEntryState("entered")} />
          <div className="dna-entry-brand">
            <span>THE BACKPROPAGATORS</span>
            <strong>PBMC3K</strong>
          </div>
          <p className="dna-entry-instruction"><span>Scroll down</span> to unwind the sequence <b>↓</b></p>
        </section>
      )}
      <header className="onepage-header">
        <div className="onepage-brand"><Mark /><span>PBMC<span>3k</span></span></div>
        <div className="onepage-header-progress"><span>THE BACKPROPAGATORS</span><strong>{String(activeSlide + 1).padStart(2, "0")} / {String(presentationSlideCount).padStart(2, "0")}</strong></div>
        <button className="replay-tour" onClick={() => setTutorialOpen(true)}>How to view</button>
      </header>
      <nav className="slide-rail" aria-label="Presentation slides">
        {[
          { id: "home", title: "Introduction" },
          ...studySlides.map((slide) => ({ id: slide.id, title: `${slide.eyebrow}: ${slide.title}` })),
          { id: "test", title: "Interactive model tester" },
        ].map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={activeSlide === index ? "active" : ""}
            aria-current={activeSlide === index ? "step" : undefined}
            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
            title={slide.title}
            onClick={() => goToSlide(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span><i />
          </button>
        ))}
      </nav>
      <nav className="slide-arrows" aria-label="Previous and next slide">
        <button onClick={() => goToSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="Previous slide">←</button>
        <button onClick={() => goToSlide(activeSlide + 1)} disabled={activeSlide === lastSlideIndex} aria-label="Next slide">→</button>
      </nav>
      <main className="slide-scroll" ref={scroller}>
        <section className="story-slide cover-slide" id="home" data-slide={0} ref={(element) => { slideRefs.current[0] = element; }}>
          <div className="cover-card">
            <div className="cover-copy">
              <span className="slide-eyebrow">THE BACKPROPAGATORS · PBMC3K</span>
              <h1>Can ML read the language of our cells?</h1>
              <p>
                We turned thousands of RNA measurements from one donor's individual blood cells into a map of immune-cell identities,
                tested whether machine learning could apply those patterns to another person, and grounded each population in verified scientific evidence.
              </p>
              <div className="cover-start">Use the arrows to begin <span>→</span></div>
              <div className="cover-stats" aria-label="Study overview">
                <div><strong>2,700</strong><span>starting cells</span></div>
                <div><strong>2,638</strong><span>after quality control</span></div>
                <div><strong>9</strong><span>reviewed cell types</span></div>
                <div><strong>224</strong><span>unique PubMed papers</span></div>
              </div>
            </div>
            <figure className="cover-visual">
              <div className="cover-image-slot">
                <img src={withBasePath("/figures/cells-ml-hero.png")} alt="Scientific illustration of immune cells sending molecular signals into a machine-learning network" />
              </div>
            </figure>
          </div>
        </section>
        {studySlides.map((slide, index) => (
          <section className="story-slide" id={slide.id} data-slide={index + 1} ref={(element) => { slideRefs.current[index + 1] = element; }} key={slide.id}>
            <MethodSlide slide={slide} />
          </section>
        ))}
        <section className="story-slide" id="test" data-slide={lastSlideIndex} ref={(element) => { slideRefs.current[lastSlideIndex] = element; }}>
          <ModelTester />
        </section>
      </main>
      <ScrollTutorial open={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}

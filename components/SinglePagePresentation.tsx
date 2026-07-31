"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Figure = { src: string; alt: string; label: string; caption: string };
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
      },
      {
        src: "/figures/classification-confusion-matrix.png",
        alt: "Normalized confusion matrix for XGBoost test predictions",
        label: "Where errors occur",
        caption: "The diagonal represents correct calls; related T-cell states create the clearest remaining confusion.",
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
    title: "Move from cluster labels to representative gene programs.",
    summary:
      "We ranked marker genes using fold change, specificity, prevalence, and statistical support. Ten representatives per cluster—90 cluster–gene entries spanning 78 unique genes—show what makes each population distinct. The largest population is IL7R+ memory/helper T cells at 22.8%; platelets are the smallest at 0.4%.",
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
    title: "Check every cluster against verified scientific evidence.",
    summary:
      "A PubMed-backed evidence layer covers all nine clusters and 78 unique representative genes. It contains 231 verified reference rows across 224 unique papers, with transparent A–E grades based on the strength of the selected evidence. Publication disease contexts are indexing information—not evidence that this donor had any disease.",
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
      "Nine isolated cluster reports combined marker observations with verified literature under strict validation rules; all nine passed. B cells, classical monocytes, and platelets reached high reasoning confidence. Activated/transitional T cells remained low confidence, while the other five populations were moderate. A validation pass confirms grounded, structurally complete reasoning—not experimental proof.",
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
    title: "A reproducible map with explicit limits.",
    summary:
      "The finished workflow connects quality control, mapping, clustering, annotation, classification, marker ranking, literature integration, biological reasoning, and validation. Transcript enrichment does not prove protein abundance, secretion, pathway activation, or function. Clusters may contain multiple states, and evidence from other tissues or diseases may not transfer directly to healthy blood.",
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
      <figure>
        <img src={figure.src} alt={figure.alt} />
        <figcaption><strong>{figure.label}</strong><span>{figure.caption}</span></figcaption>
      </figure>
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
          const response = await fetch(config.url);
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
        <h2 id="scroll-tutorial-title">Use the arrows to move through the study.</h2>
        <p>Use the bottom-right arrow buttons or your keyboard’s left and right arrow keys. Scrolling will not change slides.</p>
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

  return (
    <div className={`single-page-site ${entryState !== "ready" ? "is-revealing" : ""} ${entryState === "entered" ? "is-entered" : ""}`}>
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
        {[{ id: "home" }, ...studySlides, { id: "test" }].map((slide, index) => (
          <div key={slide.id} className={activeSlide === index ? "active" : ""} aria-current={activeSlide === index ? "step" : undefined}>
            <span>{String(index + 1).padStart(2, "0")}</span><i />
          </div>
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
                <img src="/figures/cells-ml-hero.png" alt="Scientific illustration of immune cells sending molecular signals into a machine-learning network" />
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

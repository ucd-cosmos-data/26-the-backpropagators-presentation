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
  split: "training" | "validation" | "test";
  reviewed: string;
  predicted: string;
  confidence: number;
  probabilities: number[];
};
type PredictionPayload = {
  model: string;
  classes: string[];
  cell_count: number;
  test_accuracy: number;
  test_macro_f1: number;
  cells: CellPrediction[];
};

const studySlides: StudySlide[] = [
  {
    id: "dataset",
    number: "01",
    eyebrow: "THE DATASET",
    title: "2,700 blood cells, measured one cell at a time.",
    summary:
      "PBMC3k is a single-cell RNA sequencing dataset from one healthy donor. Each cell is represented by counts of RNA molecules—the temporary instructions that cell was using when sampled.",
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
        caption: "The final atlas contains nine reviewed identities. Group sizes range from 602 memory/helper T cells to 11 platelets.",
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
    title: "Remove unreliable cells and make measurements comparable.",
    summary:
      "Quality control filters likely empty droplets, damaged cells, and possible doublets. Normalization then prevents sequencing depth from controlling every comparison.",
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
    title: "Compress thousands of genes into a map of cellular similarity.",
    summary:
      "PCA summarizes coordinated gene variation. A 15-nearest-neighbor graph links similar cells, and UMAP plus t-SNE provide two visual checks of that structure.",
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
    title: "Compare broad geometry with finer graph communities.",
    summary:
      "We tested K-means from K=2–10, then compared it with Leiden community detection. K=2 gave the clearest broad K-means split; Leiden resolution 0.5 produced nine reviewable communities.",
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
    title: "Use coordinated marker genes to name each community.",
    summary:
      "Cluster numbers are not biological identities. Wilcoxon marker tests, multiple-testing correction, marker prevalence, known immune signatures, and human review turned nine clusters into nine cell-type labels.",
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
    title: "Compare nine classifiers without letting the test set choose the winner.",
    summary:
      "A stratified 70/20/10 split created training, validation, and untouched test groups. Feature selection and tuning stayed inside training; validation macro-F1 selected XGBoost.",
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
  return (
    <div className="study-card">
      <header className="study-card-header">
        <div><span className="slide-eyebrow">SLIDE {slide.number} · {slide.eyebrow}</span><h1>{slide.title}</h1></div>
        <div className="slide-notes">
          {slide.notes.map((note) => <div key={note.label}><span>{note.label}</span><strong>{note.value}</strong></div>)}
        </div>
      </header>
      <div className="study-card-body">
        <div className="slide-copy">
          <p className="slide-summary">{slide.summary}</p>
          <div className="slide-points">
            {slide.points.map((point) => <article key={point.term}><strong>{point.term}</strong><p>{point.explanation}</p></article>)}
          </div>
        </div>
        <FigureViewer figures={slide.figures} />
      </div>
    </div>
  );
}

function ModelTester() {
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [query, setQuery] = useState("42");
  const [selected, setSelected] = useState<CellPrediction | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/data/pbmc3k-cell-predictions.json")
      .then((response) => {
        if (!response.ok) throw new Error("Prediction data unavailable");
        return response.json() as Promise<PredictionPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelected(payload.cells[41]);
      })
      .catch(() => active && setError("Prediction data could not be loaded."));
    return () => { active = false; };
  }, []);

  const topProbabilities = useMemo(() => {
    if (!data || !selected) return [];
    return data.classes
      .map((name, index) => ({ name, value: selected.probabilities[index] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
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
      : data.cells.find((item) => item.barcode.toUpperCase() === trimmed.toUpperCase());
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

  return (
    <div className="study-card test-card">
      <header className="study-card-header">
        <div><span className="slide-eyebrow">SLIDE 07 · TEST THE MODEL</span><h1>Choose a real PBMC3k cell and inspect XGBoost’s prediction.</h1></div>
        <div className="slide-notes">
          <div><span>Available cells</span><strong>2,638</strong></div>
          <div><span>Test accuracy</span><strong>90.2%</strong></div>
          <div><span>Test macro-F1</span><strong>0.893</strong></div>
        </div>
      </header>
      <div className="model-test-body">
        <form onSubmit={submit}>
          <span className="slide-eyebrow">INTERACTIVE LOOKUP</span>
          <h2>Enter a cell number</h2>
          <p>This looks up saved predictions from the finalized model; it does not process new sequencing files.</p>
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
                <div><span>XGBOOST PREDICTS</span><h2>{selected.predicted}</h2></div>
                <strong>{(selected.confidence * 100).toFixed(1)}%<small>confidence</small></strong>
              </div>
              <p className={selected.predicted === selected.reviewed ? "prediction-match" : "prediction-different"}>
                {selected.predicted === selected.reviewed ? "Matches" : "Differs from"} reviewed label: <b>{selected.reviewed}</b>
              </p>
              <div className="top-probabilities">
                {topProbabilities.map(({ name, value }) => (
                  <div key={name}><p><span>{name}</span><strong>{(value * 100).toFixed(1)}%</strong></p><i><b style={{ width: `${value * 100}%` }} /></i></div>
                ))}
              </div>
              <small>Cell {selected.number.toLocaleString()} · {selected.split === "test" ? "untouched test" : selected.split} split. Model confidence is not biological certainty.</small>
            </>
          ) : <p>Loading saved model predictions…</p>}
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
        <div className="scroll-gesture" aria-hidden="true"><i /><b>→</b></div>
        <h2 id="scroll-tutorial-title">Begin with our question, then move left to right.</h2>
        <p>Scroll, swipe, or use the arrow buttons to explore seven study slides—from the dataset and our process to a final interactive model test.</p>
        <button className="start-scroll" onClick={onClose}>Start at the question <span>→</span></button>
      </section>
    </div>
  );
}

export default function SinglePagePresentation() {
  const scroller = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    let hasSeen = false;
    try { hasSeen = window.localStorage.getItem("pbmc3k-scroll-tour-v1") === "yes"; } catch {}
    setTutorialOpen(!hasSeen);
  }, []);

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
    if (!root || index < 0 || index > 7) return;
    setActiveSlide(index);
    root.scrollTo({ left: index * root.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      root.scrollBy({ left: event.deltaY, behavior: "auto" });
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && activeSlide > 0) goToSlide(activeSlide - 1);
      if (event.key === "ArrowRight" && activeSlide < 7) goToSlide(activeSlide + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide]);

  return (
    <div className="single-page-site">
      <header className="onepage-header">
        <button className="onepage-brand" onClick={() => goToSlide(0)}><Mark /><span>PBMC<span>3k</span></span></button>
        <div className="onepage-header-progress"><span>THE BACKPROPAGATORS</span><strong>{String(activeSlide + 1).padStart(2, "0")} / 08</strong></div>
        <button className="replay-tour" onClick={() => setTutorialOpen(true)}>How to view</button>
      </header>
      <nav className="slide-rail" aria-label="Presentation slides">
        {[{ id: "home" }, ...studySlides, { id: "test" }].map((slide, index) => (
          <button key={slide.id} className={activeSlide === index ? "active" : ""} onClick={() => goToSlide(index)} aria-label={`Go to slide ${index + 1}`}>
            <span>{String(index + 1).padStart(2, "0")}</span><i />
          </button>
        ))}
      </nav>
      <nav className="slide-arrows" aria-label="Previous and next slide">
        <button onClick={() => goToSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="Previous slide">←</button>
        <button onClick={() => goToSlide(activeSlide + 1)} disabled={activeSlide === 7} aria-label="Next slide">→</button>
      </nav>
      <main className="slide-scroll" ref={scroller}>
        <section className="story-slide cover-slide" id="home" data-slide={0} ref={(element) => { slideRefs.current[0] = element; }}>
          <div className="cover-card">
            <div className="cover-copy">
              <span className="slide-eyebrow">THE BACKPROPAGATORS · PBMC3K</span>
              <h1>Can ML read the language of our cells?</h1>
              <p>
                We turned thousands of RNA measurements from individual blood cells into a map of immune-cell identities,
                then tested whether machine learning could learn those patterns.
              </p>
              <button className="cover-start" onClick={() => goToSlide(1)}>Begin the study <span>→</span></button>
              <div className="cover-stats" aria-label="Study overview">
                <div><strong>2,700</strong><span>starting cells</span></div>
                <div><strong>2,638</strong><span>after quality control</span></div>
                <div><strong>9</strong><span>reviewed cell types</span></div>
              </div>
            </div>
            <figure className="cover-visual">
              <img src="/figures/cells-ml-hero.png" alt="Scientific illustration of immune cells sending molecular signals into a machine-learning network" />
              <figcaption>
                <span>CELLS → SIGNALS → PATTERNS</span>
                <p>A conceptual view of RNA activity becoming patterns a machine-learning model can interpret.</p>
              </figcaption>
            </figure>
          </div>
        </section>
        {studySlides.map((slide, index) => (
          <section className="story-slide" id={slide.id} data-slide={index + 1} ref={(element) => { slideRefs.current[index + 1] = element; }} key={slide.id}>
            <MethodSlide slide={slide} />
          </section>
        ))}
        <section className="story-slide" id="test" data-slide={7} ref={(element) => { slideRefs.current[7] = element; }}>
          <ModelTester />
        </section>
      </main>
      <ScrollTutorial open={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}

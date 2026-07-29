"use client";

import { useEffect, useMemo, useState } from "react";
import { collaborators, processSteps, type ProcessKey } from "./data";
import CellPredictor from "./CellPredictor";

type Route = "home" | "overview" | "process" | "try" | "team";

const pathFor = (route: Route, step?: ProcessKey) =>
  route === "home" ? "/" : route === "process" && step ? `/process/${step}` : `/${route}`;

function parsePath(pathname: string): { route: Route; step: ProcessKey } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "overview") return { route: "overview", step: "preprocessing" };
  if (parts[0] === "try") return { route: "try", step: "preprocessing" };
  if (parts[0] === "team") return { route: "team", step: "preprocessing" };
  if (parts[0] === "process") {
    const requested = parts[1] as ProcessKey;
    const valid = processSteps.some((step) => step.key === requested);
    return { route: "process", step: valid ? requested : "preprocessing" };
  }
  return { route: "home", step: "preprocessing" };
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Arrow({ left = false }: { left?: boolean }) {
  return <span aria-hidden="true">{left ? "←" : "→"}</span>;
}

function Background() {
  const dots = useMemo(
    () =>
      Array.from({ length: 54 }, (_, index) => ({
        x: (index * 47 + 9) % 100,
        y: (index * 73 + 13) % 100,
        size: 2 + (index % 4),
        delay: -(index % 12),
      })),
    [],
  );

  return (
    <div className="ambient" aria-hidden="true">
      <div className="grid" />
      <div className="wash wash-one" />
      <div className="wash wash-two" />
      <svg className="dna" viewBox="0 0 180 760" preserveAspectRatio="none">
        <path d="M15 0 C170 95 5 175 160 265 S5 440 160 530 S5 675 165 760" />
        <path d="M165 0 C10 95 175 175 20 265 S175 440 20 530 S175 675 15 760" />
        {[35, 105, 175, 245, 315, 385, 455, 525, 595, 665, 735].map((y, i) => (
          <line key={y} x1={i % 2 ? 48 : 28} y1={y} x2={i % 2 ? 132 : 152} y2={y + 12} />
        ))}
      </svg>
      {dots.map((dot, index) => (
        <i
          className="particle"
          key={index}
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            animationDelay: `${dot.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Header({
  route,
  go,
  onTour,
}: {
  route: Route;
  go: (route: Route, step?: ProcessKey) => void;
  onTour: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [processMenu, setProcessMenu] = useState(false);

  const navigate = (next: Route, step?: ProcessKey) => {
    go(next, step);
    setMenu(false);
    setProcessMenu(false);
  };

  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate("home")} aria-label="PBMC3k home">
        <Mark />
        <span>PBMC<span>3k</span></span>
      </button>
      <button
        className="menu-button"
        onClick={() => setMenu((open) => !open)}
        aria-expanded={menu}
        aria-label="Open navigation"
      >
        <span />
        <span />
      </button>
      <nav className={menu ? "nav open" : "nav"} aria-label="Primary navigation">
        <button className={route === "home" ? "active" : ""} onClick={() => navigate("home")}>Home</button>
        <button className={route === "overview" ? "active" : ""} onClick={() => navigate("overview")}>Overview</button>
        <div
          className="nav-process"
          onMouseEnter={() => setProcessMenu(true)}
          onMouseLeave={() => setProcessMenu(false)}
        >
          <button
            className={route === "process" ? "active" : ""}
            onClick={() => setProcessMenu((open) => !open)}
            aria-expanded={processMenu}
          >
            Process <span className="chevron">⌄</span>
          </button>
          <div className={processMenu ? "process-menu show" : "process-menu"}>
            <p>THE WORKFLOW</p>
            {processSteps.map((step) => (
              <button key={step.key} onClick={() => navigate("process", step.key)}>
                <span>{step.number}</span>
                {step.short}
              </button>
            ))}
          </div>
        </div>
        <button className={route === "try" ? "active" : ""} onClick={() => navigate("try")}>Try</button>
        <button className={route === "team" ? "active" : ""} onClick={() => navigate("team")}>Team</button>
        <button className="tour-link" onClick={onTour}>Tour</button>
      </nav>
    </header>
  );
}

const tutorialSteps = [
  {
    label: "WELCOME",
    title: "Follow one dataset from blood sample to prediction.",
    text: "The site tells a six-step story. Start with the Overview if single-cell RNA sequencing is new to you, or jump directly into the Process.",
    action: "Next",
  },
  {
    label: "READ THE FIGURES",
    title: "Each process page pairs one decision with its evidence.",
    text: "Headlines state the conclusion. Technical terms explain the method. Captions tell you what each axis, color, or score contributes to the decision.",
    action: "Next",
  },
  {
    label: "MOVE THROUGH THE STUDY",
    title: "Use the process rail or the page controls.",
    text: "The workflow runs from quality control through clustering, annotation, model testing, and limitations. On a keyboard, the left and right arrows move between steps.",
    action: "Next",
  },
  {
    label: "TRY THE MODEL",
    title: "Finish by exploring a real cell prediction.",
    text: "The Try page uses saved PBMC3k profiles to show a predicted identity, confidence, and the genes behind that example. It is a demonstration—not a clinical tool.",
    action: "Start the story",
  },
];

function Tutorial({
  open,
  onClose,
  go,
}: {
  open: boolean;
  onClose: () => void;
  go: (route: Route, step?: ProcessKey) => void;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) setActive(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const item = tutorialSteps[active];
  const finish = () => {
    onClose();
    go("overview");
  };

  return (
    <div className="tutorial-backdrop" role="presentation">
      <section
        className="tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <div className="tutorial-progress" aria-label={`Tutorial step ${active + 1} of ${tutorialSteps.length}`}>
          {tutorialSteps.map((step, index) => (
            <button
              key={step.label}
              className={index === active ? "active" : index < active ? "complete" : ""}
              onClick={() => setActive(index)}
              aria-label={`Go to tutorial step ${index + 1}`}
            />
          ))}
        </div>
        <button className="tutorial-close" onClick={onClose} aria-label="Close tutorial">×</button>
        <span className="tutorial-label">0{active + 1} · {item.label}</span>
        <h2 id="tutorial-title">{item.title}</h2>
        <p>{item.text}</p>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={onClose}>Skip tutorial</button>
          <div>
            {active > 0 && <button className="button secondary" onClick={() => setActive(active - 1)}>Back</button>}
            <button
              className="button primary"
              onClick={() => active === tutorialSteps.length - 1 ? finish() : setActive(active + 1)}
            >
              {item.action} <Arrow />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-brand"><Mark /> PBMC3k</div>
      <p>2,700 blood-cell profiles from one healthy donor, provided by 10x Genomics.</p>
      <p className="mono">UC DAVIS COSMOS · CLUSTER 11 · 2026</p>
    </footer>
  );
}

function CellConstellation() {
  const colors = ["#728455", "#a8ba80", "#d4a45c", "#7896af", "#c27b66"];
  const points = useMemo(
    () =>
      Array.from({ length: 96 }, (_, i) => {
        const angle = i * 2.399;
        const radius = 14 + (i % 15) * 7;
        return {
          cx: (210 + Math.cos(angle) * radius * (1 + (i % 3) * 0.14)).toFixed(3),
          cy: (205 + Math.sin(angle) * radius * 0.82).toFixed(3),
          r: 3 + (i % 4) * 0.8,
          color: colors[i % colors.length],
        };
      }),
    [],
  );
  return (
    <div className="constellation-card">
      <div className="visual-label"><span />2,638 CELLS · 9 POPULATIONS</div>
      <svg viewBox="0 0 420 420" role="img" aria-label="Abstract map of single cells">
        <circle className="orbit" cx="210" cy="205" r="130" />
        <circle className="orbit" cx="210" cy="205" r="92" />
        {points.map((point, i) => <circle className="cell-dot" key={i} {...point} style={{ animationDelay: `${-(i % 17)}s` }} />)}
        <circle className="focus-ring" cx="242" cy="118" r="13" />
        <line x1="254" y1="108" x2="322" y2="65" />
        <text x="326" y="59">ONE CELL</text>
        <text className="subtext" x="326" y="76">~20k genes</text>
      </svg>
      <div className="coordinate">UMAP_1 × UMAP_2</div>
    </div>
  );
}

function Home({ go }: { go: (route: Route, step?: ProcessKey) => void }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> ONE CELL AT A TIME · 10X GENOMICS</div>
          <h1>Finding immune-cell identities in <em>PBMC3k.</em></h1>
          <p className="lede">
            We began with 2,700 blood-cell profiles from one healthy person.
            Follow how raw RNA counts became a quality-checked map, nine reviewed
            cell types, and a carefully tested classifier.
          </p>
          <div className="actions">
            <button className="button primary" onClick={() => go("overview")}>Read the overview <Arrow /></button>
            <button className="button secondary" onClick={() => go("process", "preprocessing")}>See the process <Arrow /></button>
          </div>
          <div className="hero-stats">
            <div><strong>2,700</strong><span>starting profiles</span></div>
            <div><strong>2,638</strong><span>passed quality checks</span></div>
            <div><strong>9</strong><span>reviewed cell types</span></div>
          </div>
        </div>
        <CellConstellation />
      </section>
      <section className="intro-strip">
        <p>Start with the biology, then follow every analysis decision</p>
        <span className="scroll-line" />
        <blockquote>“One dot represents one cell and thousands of RNA measurements.”</blockquote>
      </section>
    </main>
  );
}

function Overview({ go }: { go: (route: Route, step?: ProcessKey) => void }) {
  const [active, setActive] = useState(0);
  const concepts = [
    {
      label: "PBMC",
      title: "A blood sample becomes a window into immunity",
      text: "PBMC stands for peripheral blood mononuclear cell. In everyday language, these are mostly immune cells collected from blood, including T cells, B cells, natural killer cells, and monocytes.",
    },
    {
      label: "scRNA-seq",
      title: "Measure each cell instead of one average",
      text: "Single-cell RNA sequencing counts RNA molecules separately for thousands of cells. Because RNA reflects which genes a cell is using, each cell receives a molecular activity profile rather than disappearing into a sample-wide average.",
    },
    {
      label: "Markers",
      title: "Gene combinations work like fingerprints",
      text: "A marker is a gene that is especially active in a particular cell type. We identify cells from combinations—for example, CD3D with other T-cell genes—not from one gene in isolation.",
    },
  ];
  return (
    <main className="page-main">
      <section className="page-heading">
        <div className="eyebrow"><span /> OVERVIEW · START HERE</div>
        <h1>Blood contains a <em>team</em> of specialists.</h1>
        <p>
          PBMC3k records gene activity from about 2,700 cells belonging to one
          healthy donor. Our goal was to find the cell types hidden in that
          enormous table and test how reliably a model could recognize them.
        </p>
      </section>

      <section className="concept-lab">
        <div className="concept-tabs" role="tablist" aria-label="Core concepts">
          {concepts.map((concept, index) => (
            <button
              role="tab"
              aria-selected={active === index}
              className={active === index ? "active" : ""}
              onClick={() => setActive(index)}
              key={concept.label}
            >
              <span>0{index + 1}</span>{concept.label}
            </button>
          ))}
        </div>
        <div className="concept-content">
          <div>
            <span className="kicker">{concepts[active].label}</span>
            <h2>{concepts[active].title}</h2>
            <p>{concepts[active].text}</p>
          </div>
          <ConceptVisual index={active} />
        </div>
      </section>

      <section className="story-grid">
        <div className="story-title">
          <span className="section-index">THE CENTRAL IDEA</span>
          <h2>RNA is a temporary record of which instructions a cell is using <em>right now.</em></h2>
        </div>
        <div className="gene-readout">
          {[
            ["CD3D", 86, "T-cell signal"],
            ["IL7R", 68, "Memory T-cell signal"],
            ["ACTB", 92, "Housekeeping"],
            ["MS4A1", 4, "B-cell signal"],
          ].map(([gene, value, meaning]) => (
            <div className="gene-row" key={gene}>
              <span>{gene}</span>
              <div><i style={{ width: `${value}%` }} /></div>
              <small>{meaning}</small>
            </div>
          ))}
          <p className="mono note">EXAMPLE CELL · NORMALIZED EXPRESSION</p>
        </div>
      </section>

      <section className="question">
        <span>OUR QUESTION</span>
        <h2>Can we turn millions of RNA counts into a trustworthy map of immune-cell identities?</h2>
        <button className="button primary" onClick={() => go("process", "preprocessing")}>Follow the analysis <Arrow /></button>
      </section>
    </main>
  );
}

function ConceptVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="concept-visual blood">
        {["T", "B", "NK", "M", "T", "T", "M", "B", "T", "NK", "T", "M"].map((label, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties}>{label}</span>
        ))}
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="concept-visual compare">
        <div><div className="blurred-cells" /><p>Bulk RNA-seq</p><small>one average</small></div>
        <b>→</b>
        <div><div className="separate-cells">{Array.from({length: 9}, (_, i) => <i key={i} />)}</div><p>Single cell</p><small>every identity</small></div>
      </div>
    );
  }
  return (
    <div className="concept-visual markers">
      {["CD3D", "NKG7", "MS4A1", "LST1", "IL7R", "GNLY"].map((gene, i) => (
        <span key={gene} style={{ "--i": i } as React.CSSProperties}>{gene}</span>
      ))}
    </div>
  );
}

function ProcessVisual({ step }: { step: ProcessKey }) {
  if (step === "further-work") return (
    <div className="process-viz roadmap-viz">
      <div className="viz-header"><span>RESEARCH ROADMAP</span><span>next</span></div>
      {[
        ["01", "External cohorts", "Test whether labels transfer across donors."],
        ["02", "Batch correction", "Separate biological signal from protocol effects."],
        ["03", "Rare-cell resolution", "Collect more examples of platelets and dendritic cells."],
        ["04", "Independent labels", "Validate against expert or multimodal ground truth."],
      ].map(([n, title, text]) => (
        <div className="roadmap-row" key={n}><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div><span>↗</span></div>
      ))}
    </div>
  );

  const figures: Record<
    Exclude<ProcessKey, "further-work">,
    { src: string; alt: string; label: string; caption: string }
  > = {
    preprocessing: {
      src: "/figures/qc-retained-cell-distributions.png",
      alt: "Three histograms showing RNA counts, detected genes, and mitochondrial RNA among the 2,638 cells retained after quality control",
      label: "FIG. 01 · QUALITY CONTROL",
      caption: "QC retained 97.7% of starting profiles. Red dashed lines mark the gene-count and mitochondrial-RNA thresholds.",
    },
    eda: {
      src: "/figures/eda-pca-umap.png",
      alt: "PCA variance curve beside a UMAP of the 15-nearest-neighbor graph colored into nine Leiden communities",
      label: "FIG. 02 · DIMENSION REDUCTION",
      caption: "PCA compresses expression before UMAP draws the 15-neighbor graph. The first 10 PCs were used for downstream structure.",
    },
    clustering: {
      src: "/figures/clustering-kmeans-leiden-comparison.png",
      alt: "Side-by-side UMAP comparison of K-means with two groups and Leiden with nine communities",
      label: "FIG. 03 · CLUSTERING CROSS-CHECK",
      caption: "The same UMAP receives two label sets. K-means shows broad geometry; Leiden follows finer communities in the neighbor graph.",
    },
    annotation: {
      src: "/figures/annotation-marker-dotplot.png",
      alt: "Dot plot of known immune marker genes across nine reviewed cell types",
      label: "FIG. 04 · MARKER EVIDENCE",
      caption: "Dot size is the percentage of cells expressing a gene; color is mean expression. Labels rely on coordinated marker programs.",
    },
    model: {
      src: "/figures/classification-model-comparison.png",
      alt: "Grouped bar chart comparing validation and test macro-F1 and ROC AUC across nine classifiers",
      label: "FIG. 05 · MODEL COMPARISON",
      caption: "XGBoost ranks first by the prespecified validation macro-F1. Test metrics are shown only as final estimates.",
    },
  };
  const figure = figures[step];

  return (
    <figure className="process-viz data-figure">
      <img src={figure.src} alt={figure.alt} />
      <figcaption>
        <span>{figure.label}</span>
        {figure.caption}
      </figcaption>
    </figure>
  );
}

function ProcessPage({
  activeStep,
  go,
}: {
  activeStep: ProcessKey;
  go: (route: Route, step?: ProcessKey) => void;
}) {
  const index = processSteps.findIndex((step) => step.key === activeStep);
  const step = processSteps[index];
  const previous = processSteps[index - 1];
  const next = processSteps[index + 1];
  const [guideSlide, setGuideSlide] = useState(0);

  useEffect(() => setGuideSlide(0), [activeStep]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && previous) go("process", previous.key);
      if (event.key === "ArrowRight" && next) go("process", next.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, previous, next]);

  return (
    <main className="process-page">
      <aside className="step-rail" aria-label="Analysis steps">
        <p>PROCESS</p>
        {processSteps.map((item, itemIndex) => (
          <button
            key={item.key}
            onClick={() => go("process", item.key)}
            className={item.key === activeStep ? "active" : itemIndex < index ? "complete" : ""}
          >
            <span>{item.number}</span>
            <i />
            <b>{item.short}</b>
          </button>
        ))}
      </aside>
      <section className="step-content" key={step.key}>
        <div className="step-copy">
          <div className="eyebrow"><span /> STEP {step.number} · {step.eyebrow}</div>
          <h1>{step.title}</h1>
          <p className="lede">{step.description}</p>
          <div className="method-notes">
            {step.notes.map((note) => <div key={note.label}><span>{note.label}</span><strong>{note.value}</strong></div>)}
          </div>
          <p className="interaction-hint"><kbd>←</kbd><kbd>→</kbd> Use arrow keys to move through the workflow</p>
        </div>
        <ProcessVisual step={step.key} />
      </section>
      <section className="step-guide" aria-labelledby={`${step.key}-guide-title`}>
        <div className="step-guide-heading">
          <span>METHOD SLIDES</span>
          <h2 id={`${step.key}-guide-title`}>One decision and one visual at a time.</h2>
        </div>
        <div className="method-slides">
          {step.guide.map((item, guideIndex) => (
            <article
              className={guideIndex === guideSlide ? "method-slide active" : "method-slide"}
              key={item.label}
              aria-hidden={guideIndex !== guideSlide}
            >
              <div className="method-slide-copy">
                <span>SLIDE {guideIndex + 1} / {step.guide.length} · {item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <div className="method-slide-visual">
                {item.visual ? (
                <figure>
                  <img src={item.visual.src} alt={item.visual.alt} />
                  <figcaption>{item.visual.caption}</figcaption>
                </figure>
                ) : (
                  <ProcessVisual step={step.key} />
                )}
              </div>
            </article>
          ))}
          <div className="method-slide-controls">
            <button
              onClick={() => setGuideSlide((current) => Math.max(0, current - 1))}
              disabled={guideSlide === 0}
              aria-label="Previous method slide"
            >
              <Arrow left /> Previous
            </button>
            <div>
              {step.guide.map((item, itemIndex) => (
                <button
                  key={item.label}
                  className={itemIndex === guideSlide ? "active" : ""}
                  onClick={() => setGuideSlide(itemIndex)}
                  aria-label={`Show slide ${itemIndex + 1}: ${item.label}`}
                />
              ))}
            </div>
            <button
              onClick={() => setGuideSlide((current) => Math.min(step.guide.length - 1, current + 1))}
              disabled={guideSlide === step.guide.length - 1}
            >
              Next <Arrow />
            </button>
          </div>
        </div>
      </section>
      <div className="step-pager">
        {previous ? (
          <button onClick={() => go("process", previous.key)}><Arrow left /><span>PREVIOUS<small>{previous.short}</small></span></button>
        ) : <span />}
        <p><b>{index + 1}</b> / {processSteps.length}</p>
        {next ? (
          <button onClick={() => go("process", next.key)}><span>NEXT<small>{next.short}</small></span><Arrow /></button>
        ) : (
          <button onClick={() => go("team")}><span>MEET<small>The team</small></span><Arrow /></button>
        )}
      </div>
    </main>
  );
}

function Team() {
  return (
    <main className="page-main team-page">
      <section className="page-heading">
        <div className="eyebrow"><span /> THE BACKPROPAGATORS · UC DAVIS COSMOS</div>
        <h1>Four curious minds. <em>One shared dataset.</em></h1>
        <p>We explored the biology, challenged the models, and built the story together.</p>
      </section>
      <section className="team-grid">
        {collaborators.map((person, index) => (
          <article className="person-card" key={person.name}>
            <div className="portrait">
              <img src={person.photo} alt={`${person.name}, member of The Backpropagators`} />
              <span>0{index + 1}</span>
            </div>
            <div className="person-info">
              <p>{person.role}</p>
              <h2>{person.name}</h2>
              <span>{person.location}</span>
              <blockquote>{person.fact}</blockquote>
            </div>
          </article>
        ))}
      </section>
      <section className="team-note">
        <div><span>THE SETTING</span><h2>UC Davis COSMOS<br />Cluster 11</h2></div>
        <p>A collaborative summer research project that connects biology, statistics, machine learning, and communication using open data and reproducible notebooks.</p>
      </section>
    </main>
  );
}

export default function Presentation() {
  const initial = { route: "home" as Route, step: "preprocessing" as ProcessKey };
  const [location, setLocation] = useState(initial);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    const update = () => setLocation(parsePath(window.location.pathname));
    update();
    let hasSeenTour = false;
    try {
      hasSeenTour = window.localStorage.getItem("pbmc3k-tour-seen") === "yes";
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
    if (!hasSeenTour) {
      setTutorialOpen(true);
    }
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const closeTutorial = () => {
    try {
      window.localStorage.setItem("pbmc3k-tour-seen", "yes");
    } catch {
      // The tutorial can still be dismissed when storage is unavailable.
    }
    setTutorialOpen(false);
  };

  const go = (route: Route, step?: ProcessKey) => {
    const nextStep = step ?? location.step;
    const path = pathFor(route, step);
    window.history.pushState({}, "", path);
    setLocation({ route, step: nextStep });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Background />
      <Header route={location.route} go={go} onTour={() => setTutorialOpen(true)} />
      {location.route === "home" && <Home go={go} />}
      {location.route === "overview" && <Overview go={go} />}
      {location.route === "process" && <ProcessPage activeStep={location.step} go={go} />}
      {location.route === "try" && <CellPredictor />}
      {location.route === "team" && <Team />}
      <Footer />
      <Tutorial open={tutorialOpen} onClose={closeTutorial} go={go} />
    </>
  );
}

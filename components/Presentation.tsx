"use client";

import { useEffect, useMemo, useState } from "react";
import { cellTypes, collaborators, processSteps, type ProcessKey } from "./data";

type Route = "home" | "overview" | "process" | "team";

const pathFor = (route: Route, step?: ProcessKey) =>
  route === "home" ? "/" : route === "process" && step ? `/process/${step}` : `/${route}`;

function parsePath(pathname: string): { route: Route; step: ProcessKey } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "overview") return { route: "overview", step: "preprocessing" };
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
}: {
  route: Route;
  go: (route: Route, step?: ProcessKey) => void;
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
        <button className={route === "team" ? "active" : ""} onClick={() => navigate("team")}>Team</button>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-brand"><Mark /> PBMC3k</div>
      <p>Built from a healthy-donor dataset provided by 10x Genomics.</p>
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
          <div className="eyebrow"><span /> SINGLE-CELL RNA-SEQ · 10X GENOMICS</div>
          <h1>Decoding the <em>PBMC3k</em> transcriptome.</h1>
          <p className="lede">
            An end-to-end walk through 2,638 immune cells — from raw gene counts
            to biological identities and predictive models.
          </p>
          <div className="actions">
            <button className="button primary" onClick={() => go("overview")}>Read the overview <Arrow /></button>
            <button className="button secondary" onClick={() => go("process", "preprocessing")}>See the process <Arrow /></button>
          </div>
          <div className="hero-stats">
            <div><strong>2,638</strong><span>cells retained</span></div>
            <div><strong>9</strong><span>cell populations</span></div>
            <div><strong>20k+</strong><span>genes measured</span></div>
          </div>
        </div>
        <CellConstellation />
      </section>
      <section className="intro-strip">
        <p>Scroll to enter the dataset</p>
        <span className="scroll-line" />
        <blockquote>“One cell, one point, one molecular story.”</blockquote>
      </section>
    </main>
  );
}

function Overview({ go }: { go: (route: Route, step?: ProcessKey) => void }) {
  const [active, setActive] = useState(0);
  const concepts = [
    {
      label: "PBMC",
      title: "A window into the immune system",
      text: "Peripheral blood mononuclear cells are immune cells with a single round nucleus: T cells, B cells, NK cells, monocytes, and a few rarer populations.",
    },
    {
      label: "scRNA-seq",
      title: "Measure every cell individually",
      text: "Traditional RNA sequencing averages millions of cells. Single-cell sequencing keeps each cell separate, preserving the differences that reveal identity and state.",
    },
    {
      label: "Markers",
      title: "Expression works like a fingerprint",
      text: "Genes such as CD3D, MS4A1, NKG7, and LST1 form recognizable patterns. We use combinations of these markers—not single genes—to name populations.",
    },
  ];
  return (
    <main className="page-main">
      <section className="page-heading">
        <div className="eyebrow"><span /> OVERVIEW · START HERE</div>
        <h1>Blood contains a <em>crowd</em> of specialists.</h1>
        <p>No biology background required. Start with the big picture, then peel back the technical layers.</p>
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
          <h2>A cell’s RNA is a snapshot of what it is doing <em>right now.</em></h2>
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
        <h2>Can we recover the immune-cell populations hidden inside a matrix of gene counts?</h2>
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
  if (step === "preprocessing") {
    return (
      <div className="process-viz qc-viz">
        <div className="viz-header"><span>QC DISTRIBUTIONS</span><span>before → after</span></div>
        <div className="violins">
          {[65, 82, 48].map((height, i) => (
            <div key={i}><i className="violin before" style={{ height }} /><i className="violin after" style={{ height: height * .74 }} /><p>{["genes", "counts", "mt%"][i]}</p></div>
          ))}
        </div>
        <div className="threshold"><span>retain</span><i /><span>2,638 cells</span></div>
      </div>
    );
  }
  if (step === "eda") {
    return (
      <div className="process-viz reduction-viz">
        <div className="viz-header"><span>DIMENSIONALITY</span><span>20,000+ → 2</span></div>
        <div className="matrix">{Array.from({ length: 160 }, (_, i) => <i key={i} style={{ opacity: ((i * 13) % 9) / 10 + .08 }} />)}</div>
        <span className="reduction-arrow">→</span>
        <div className="mini-umap">
          {Array.from({ length: 68 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${9 + ((i * 37) % 80)}%`,
                top: `${8 + ((i * 53) % 82)}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (step === "clustering") {
    return (
      <div className="process-viz image-viz">
        {/* The image is a result generated by the project notebooks. */}
        <img src="/figures/leiden-clusters.png" alt="UMAP showing the selected nine-cluster Leiden solution" />
        <div className="image-caption"><span>FIG. 03</span> Selected Leiden solution · 9 clusters</div>
      </div>
    );
  }
  if (step === "annotation") {
    return (
      <div className="process-viz annotation-viz">
        <div className="viz-header"><span>REVIEWED CELL ATLAS</span><span>2,638 total</span></div>
        <div className="population-list">
          {cellTypes.map((type) => (
            <div className="population" key={type.name}>
              <button>
                <i style={{ background: type.color }} />
                <span>{type.name}<small>{type.markers}</small></span>
                <b>{type.count}</b>
              </button>
              <div><i style={{ width: `${(type.count / 602) * 100}%`, background: type.color }} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (step === "model") {
    const models = [
      ["Logistic regression", 93.2],
      ["SGD classifier", 93.2],
      ["Multinomial NB", 91.3],
      ["Support vector machine", 90.9],
      ["XGBoost", 90.2],
      ["K-nearest neighbors", 44.3],
    ];
    return (
      <div className="process-viz model-viz">
        <div className="viz-header"><span>UNTOUCHED TEST ACCURACY</span><span>n = 264</span></div>
        {models.map(([name, score], i) => (
          <div className="model-row" key={name}>
            <span>0{i + 1}</span><p>{name}</p>
            <div><i style={{ width: `${score}%` }} /></div><b>{score}%</b>
          </div>
        ))}
        <p className="model-note">XGBoost won on validation; logistic regression generalized best on the held-out test set.</p>
      </div>
    );
  }
  return (
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
        <p>A collaborative summer research project in data science and machine learning, built with open data and reproducible notebooks.</p>
      </section>
    </main>
  );
}

export default function Presentation() {
  const initial = { route: "home" as Route, step: "preprocessing" as ProcessKey };
  const [location, setLocation] = useState(initial);

  useEffect(() => {
    const update = () => setLocation(parsePath(window.location.pathname));
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

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
      <Header route={location.route} go={go} />
      {location.route === "home" && <Home go={go} />}
      {location.route === "overview" && <Overview go={go} />}
      {location.route === "process" && <ProcessPage activeStep={location.step} go={go} />}
      {location.route === "team" && <Team />}
      <Footer />
    </>
  );
}

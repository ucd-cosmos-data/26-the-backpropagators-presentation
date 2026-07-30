export type ProcessKey =
  | "preprocessing"
  | "eda"
  | "clustering"
  | "annotation"
  | "model"
  | "further-work";

export const processSteps: {
  key: ProcessKey;
  number: string;
  eyebrow: string;
  title: string;
  short: string;
  description: string;
  notes: { label: string; value: string }[];
  guide: {
    label: string;
    title: string;
    text: string;
    visual?: { src: string; alt: string; caption: string };
  }[];
}[] = [
  {
    key: "preprocessing",
    number: "01",
    eyebrow: "QUALITY CONTROL",
    title: "First, make every cell trustworthy and comparable.",
    short: "Preprocessing",
    description:
      "We removed damaged or ambiguous profiles, then placed the remaining cells on a comparable expression scale.",
    notes: [
      { label: "Starting profiles", value: "2,700 cells" },
      { label: "Retained after QC", value: "2,638 (97.7%)" },
      { label: "Analysis genes", value: "2,000 variable" },
    ],
    guide: [
      {
        label: "STARTING POINT",
        title: "We used the official 10x Genomics count matrix.",
        text: "Analysis began with Cell Ranger’s filtered gene-by-cell matrix: RNA counts for 2,700 likely cells. The larger download also contains reads and molecule-level files.",
      },
      {
        label: "QUALITY CHECK",
        title: "62 suspicious profiles were removed.",
        text: "We kept cells with 200–2,499 detected genes and under 5% mitochondrial RNA. Low counts suggest broken droplets, high counts can indicate doublets, and excess mitochondrial RNA often signals stress.",
      },
      {
        label: "FAIR COMPARISON",
        title: "We normalized each cell to 10,000 total counts.",
        text: "Sequencing depth varies by cell. Scaling totals and applying log1p keeps deep sequencing or a few abundant genes from dominating; raw integer counts remain preserved.",
      },
      {
        label: "FOCUS",
        title: "We kept the 2,000 genes that varied most.",
        text: "After removing genes seen in fewer than three cells, 13,656 remained. We used the 2,000 most variable for mapping and clustering, while retaining all normalized genes for marker tests.",
      },
    ],
  },
  {
    key: "eda",
    number: "02",
    eyebrow: "EXPLORATORY ANALYSIS",
    title: "Turn thousands of gene measurements into a map.",
    short: "EDA",
    description:
      "We compressed thousands of gene values, connected similar cells, and drew two complementary two-dimensional maps.",
    notes: [
      { label: "PCA dimensions used", value: "First 10" },
      { label: "Neighbors per cell", value: "15" },
      { label: "Map cross-check", value: "UMAP + t-SNE" },
    ],
    guide: [
      {
        label: "STEP DOWN",
        title: "PCA creates a compact summary of gene activity.",
        text: "Principal component analysis (PCA) combines correlated genes into summary axes. We scaled 2,000 variable genes and used the first 10 components, which capture 10.2% of variation.",
      },
      {
        label: "CONNECT",
        title: "Every cell is linked to its 15 nearest neighbors.",
        text: "The nearest-neighbor graph links each cell to 15 cells with similar PCA profiles. Leiden later clusters this network—not the drawing itself.",
      },
      {
        label: "DRAW",
        title: "UMAP and t-SNE provide two views of the same cells.",
        text: "UMAP draws the neighbor graph; t-SNE provides an independent view. Agreement supports a pattern, while disagreement can expose an embedding artifact.",
        visual: {
          src: "/figures/umap-tsne-comparison.png",
          alt: "UMAP and t-SNE plots of the same 2,638 cells colored by the nine final Leiden labels",
          caption: "Same cells and labels, different nonlinear embeddings. Similar structure across both views makes an embedding artifact less likely.",
        },
      },
      {
        label: "CAUTION",
        title: "The map is a guide, not a literal coordinate system.",
        text: "UMAP and t-SNE axes have no biological units. Local neighbors matter; exact gaps, island sizes, and locations such as “top left” do not.",
      },
    ],
  },
  {
    key: "clustering",
    number: "03",
    eyebrow: "COMMUNITY DETECTION",
    title: "Ask two methods where the natural groups are.",
    short: "Clustering",
    description:
      "We compared geometric and graph-based clustering, tested several settings, and selected nine communities for biological review.",
    notes: [
      { label: "K-means tested", value: "K = 2–10" },
      { label: "Final graph method", value: "Leiden, r = 0.5" },
      { label: "Reference groups", value: "9 communities" },
    ],
    guide: [
      {
        label: "BROAD CHECK",
        title: "K-means suggested two broad expression groups.",
        text: "We tested K=2–10 using elbow, silhouette, stability, minimum size, QC differences, and UMAP views. K=2 gave the clearest broad K-means split.",
        visual: {
          src: "/figures/kmeans-k2-k10-diagnostics.png",
          alt: "Elbow and silhouette plots for K-means solutions from K equals 2 through K equals 10",
          caption: "The elbow appears near K=4, while the highest silhouette score occurs at K=2. Neither curve was treated as a complete biological answer.",
        },
      },
      {
        label: "FINER STRUCTURE",
        title: "Leiden found communities in the neighbor network.",
        text: "Leiden follows irregular communities in a graph and does not require a fixed K. Across six resolutions, 0.5 produced our nine-cluster reference.",
        visual: {
          src: "/figures/leiden-resolution-diagnostics.png",
          alt: "Four diagnostic plots comparing Leiden resolutions from 0.3 through 0.8",
          caption: "Resolution 0.5 balances nine communities, separation, repeat-run stability, and technical-quality association. It is a validated team choice, not a universal optimum.",
        },
      },
      {
        label: "WHY THEY DIFFER",
        title: "K-means and Leiden answer related, not identical, questions.",
        text: "Their adjusted Rand index was 0.206, so the assignments differed substantially. K-means captured broad geometry; Leiden separated finer local communities.",
        visual: {
          src: "/figures/alternative-clustering-methods.png",
          alt: "UMAP comparison of K-means, agglomerative, Gaussian mixture, and Leiden cluster labels",
          caption: "Agglomerative and Gaussian-mixture clustering are shown as exploratory alternatives only. Their labels were not used to annotate the cells.",
        },
      },
      {
        label: "DECISION RULE",
        title: "No single curve declared the correct answer.",
        text: "We retained nine clusters after checking stability, size, UMAP/t-SNE coherence, QC patterns, and marker genes. It is a defensible resolution, not a uniquely correct answer.",
      },
    ],
  },
  {
    key: "annotation",
    number: "04",
    eyebrow: "BIOLOGICAL INTERPRETATION",
    title: "Use gene fingerprints to give each group a name.",
    short: "Annotation",
    description:
      "We translated numbered clusters into cell types using enriched genes, known immune signatures, and human review.",
    notes: [
      { label: "Reviewed identities", value: "9 cell types" },
      { label: "Label confidence", value: "7 high · 2 moderate" },
      { label: "Rarest identity", value: "11 platelets" },
    ],
    guide: [
      {
        label: "FIND CLUES",
        title: "Every cluster was compared with all other cells.",
        text: "A Wilcoxon test ranked enriched genes across the full normalized dataset. We corrected for multiple testing, then checked fold change and expression prevalence.",
      },
      {
        label: "READ A FINGERPRINT",
        title: "Several related markers support one identity.",
        text: "T cells show CD3D/CD3E, B cells MS4A1/CD79A, NK cells NKG7/GNLY, monocytes LYZ/LST1, and platelets PPBP/PF4. A coordinated marker program is stronger evidence than one gene.",
      },
      {
        label: "HUMAN REVIEW",
        title: "Nine cluster numbers became nine reviewed labels.",
        text: "We identified four T-cell states, B cells, two monocyte groups, NK cells, and platelets. Seven labels were high-confidence; two overlapping T-cell states were moderate.",
        visual: {
          src: "/figures/leiden-clusters.png",
          alt: "UMAP of the nine selected Leiden clusters before biological cell-type names were assigned",
          caption: "Leiden supplies numbered communities. Marker evidence and human review—not UMAP position alone—turn those numbers into biological labels.",
        },
      },
      {
        label: "CHECK ALTERNATIVES",
        title: "Strong RNA can describe condition rather than identity.",
        text: "We tested whether dominant genes reflected lineage, stress, ribosomes, mitochondria, or library quality. Mixed programs can flag doublets; the 11-cell platelet group remains fragile.",
      },
    ],
  },
  {
    key: "model",
    number: "05",
    eyebrow: "SUPERVISED LEARNING",
    title: "Can a model repeat the reviewed cell labels?",
    short: "Model",
    description:
      "We compared nine classifiers on one shared split, keeping the final test cells outside every selection decision.",
    notes: [
      { label: "Data split", value: "70% / 20% / 10%" },
      { label: "Selection metric", value: "Validation macro-F1" },
      { label: "Selected model", value: "XGBoost" },
    ],
    guide: [
      {
        label: "FAIR SPLIT",
        title: "1,846 cells trained, 528 validated, and 264 tested.",
        text: "A stratified 70/20/10 split produced 1,846 training, 528 validation, and 264 test cells. Training fits models, validation selects one, and test estimates final performance.",
        visual: {
          src: "/figures/classification-class-balance.png",
          alt: "Bar chart showing the number of cells in each reviewed cell type",
          caption: "Class sizes are highly uneven: the largest group has 602 cells, while the platelet group has only 11. This is why macro-F1 matters.",
        },
      },
      {
        label: "NO PEEKING",
        title: "Feature selection stayed inside the training data.",
        text: "Constant-gene removal, ANOVA feature selection, scaling, and three-fold tuning used training cells only. This blocks validation and test leakage.",
        visual: {
          src: "/figures/classification-top-selected-genes.png",
          alt: "Horizontal bar chart of the 25 genes with the largest training-only ANOVA feature scores",
          caption: "These training-only ANOVA scores measure association with labels. They are not causal effects and are not XGBoost feature importance.",
        },
      },
      {
        label: "NINE CONTENDERS",
        title: "We compared linear, tree, neural, and neighbor methods.",
        text: "We tested logistic regression, MLP, XGBoost, SGD, random forest, SVM, K-nearest neighbors, Extra Trees, and Naive Bayes. Macro-F1 weighted each cell type equally.",
      },
      {
        label: "RESULT",
        title: "XGBoost won validation before the test set was opened.",
        text: "XGBoost won validation macro-F1 at 0.928, then reached 90.2% test accuracy and 0.893 test macro-F1. Logistic regression scored higher on test, but switching afterward would misuse the test set.",
        visual: {
          src: "/figures/classification-confusion-matrix.png",
          alt: "Normalized confusion matrix for XGBoost predictions on the untouched test cells",
          caption: "Rows are reviewed labels and columns are predictions. A strong diagonal means correct classification; off-diagonal cells reveal which populations are confused.",
        },
      },
      {
        label: "WEAKEST POINT",
        title: "Related T-cell states were hardest to separate.",
        text: "Activated/transitional T-cell recall was 53.8% across 13 test examples. Platelet recall came from one cell, so its apparent 100% is weak evidence.",
      },
    ],
  },
  {
    key: "further-work",
    number: "06",
    eyebrow: "WHAT COMES NEXT",
    title: "A useful reference map, not the final word.",
    short: "Further work",
    description:
      "The workflow reproduced clear patterns inside PBMC3k, but it has not yet been tested across donors, laboratories, or sequencing runs.",
    notes: [
      { label: "Current donors", value: "1 healthy person" },
      { label: "Ground truth", value: "Reviewed expression labels" },
      { label: "Next test", value: "Independent donors" },
    ],
    guide: [
      {
        label: "MAIN LIMIT",
        title: "All cells came from one healthy donor.",
        text: "Random cell splits place closely related cells from the same person in training and test. These scores measure within-dataset reproducibility, not donor-to-donor generalization.",
      },
      {
        label: "LABEL LIMIT",
        title: "The model learned labels inferred from this same RNA dataset.",
        text: "High accuracy means the model reproduced our reviewed annotations. Independent expert labels, protein measurements, or other assays would provide stronger ground truth.",
      },
      {
        label: "METHOD LIMIT",
        title: "Maps and clusters depend on analysis choices.",
        text: "Normalization, selected genes, PCA dimensions, neighbor count, and Leiden resolution can move boundaries. Rare groups remain uncertain, and batch effects can look biological.",
      },
      {
        label: "NEXT STUDY",
        title: "Validate on independently processed donors.",
        text: "Next, use group-aware donor splits, consistent preprocessing, batch correction, expert or multimodal labels, and more examples of rare populations.",
      },
    ],
  },
];

export const cellTypes = [
  { name: "IL7R+ memory/helper T", count: 602, color: "#55a9d3", markers: "CD3D · IL7R · LTB" },
  { name: "Classical monocytes", count: 502, color: "#d45f52", markers: "LYZ · S100A8 · FCN1" },
  { name: "Naive/resting T", count: 450, color: "#81c6dc", markers: "CCR7 · IL7R · CD3E" },
  { name: "B cells", count: 348, color: "#2f8fc3", markers: "MS4A1 · CD79A · CD74" },
  { name: "Cytotoxic CD8 T", count: 273, color: "#4e70b5", markers: "CD8A · CCL5 · GZMK" },
  { name: "CD16+ monocytes", count: 171, color: "#d98555", markers: "FCGR3A · LST1 · CFD" },
  { name: "NK cells", count: 153, color: "#239c98", markers: "GNLY · NKG7 · PRF1" },
  { name: "Activated T", count: 128, color: "#8a6fb7", markers: "CCL5 · GZMK · IL32" },
  { name: "Platelets", count: 11, color: "#d7aa3e", markers: "PPBP · PF4 · GNG11" },
];

export const collaborators = [
  {
    name: "Shely",
    role: "Data scientist · Storyteller",
    location: "Emerald High School · Dublin",
    photo: "/team/shely.png",
    fact: "Turns complex analysis into an experience people can explore.",
  },
  {
    name: "Ema",
    role: "Data scientist · Researcher",
    location: "Leigh High School · Los Gatos",
    photo: "/team/ema.jpeg",
    fact: "Brings a global perspective — and three citizenships — to the team.",
  },
  {
    name: "Brian",
    role: "Data scientist · Engineer",
    location: "Carlmont High School · Redwood City",
    photo: "/team/brian.png",
    fact: "Builds careful, reproducible systems; assisted by a cat named Kimi.",
  },
  {
    name: "Liam",
    role: "Data scientist · Analyst",
    location: "Miramonte High School · Orinda",
    photo: "/team/liam.png",
    fact: "Born in the Cayman Islands and always ready to ask the next question.",
  },
];

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
}[] = [
  {
    key: "preprocessing",
    number: "01",
    eyebrow: "QUALITY CONTROL",
    title: "Clean signals start with careful filters.",
    short: "Preprocessing",
    description:
      "We remove low-information droplets, possible doublets, and stressed cells before normalizing each cell to a comparable library size.",
    notes: [
      { label: "Genes / cell", value: "200–2,500" },
      { label: "Mitochondrial RNA", value: "< 5%" },
      { label: "Selected features", value: "2,000 genes" },
    ],
  },
  {
    key: "eda",
    number: "02",
    eyebrow: "EXPLORATORY ANALYSIS",
    title: "Compress 20,000 dimensions into a map.",
    short: "EDA",
    description:
      "PCA captures the strongest expression programs. A nearest-neighbor graph and UMAP then reveal local relationships between cells.",
    notes: [
      { label: "Representation", value: "PCA" },
      { label: "Neighborhood", value: "15 nearest" },
      { label: "Views", value: "UMAP + t-SNE" },
    ],
  },
  {
    key: "clustering",
    number: "03",
    eyebrow: "COMMUNITY DETECTION",
    title: "Let similar cells find one another.",
    short: "Clustering",
    description:
      "Leiden community detection groups cells on the neighbor graph. We compare solutions, inspect stability, and retain a nine-cluster reference.",
    notes: [
      { label: "Method", value: "Leiden" },
      { label: "Selected solution", value: "9 clusters" },
      { label: "Cross-check", value: "K-means K=2–10" },
    ],
  },
  {
    key: "annotation",
    number: "04",
    eyebrow: "BIOLOGICAL INTERPRETATION",
    title: "Markers turn clusters into cell identities.",
    short: "Annotation",
    description:
      "Differentially expressed genes are matched to established immune programs. Multiple concordant markers support every reviewed label.",
    notes: [
      { label: "Largest population", value: "IL7R+ T cells" },
      { label: "Rare population", value: "11 platelets" },
      { label: "Confidence", value: "7 high · 2 moderate" },
    ],
  },
  {
    key: "model",
    number: "05",
    eyebrow: "SUPERVISED LEARNING",
    title: "Can gene expression predict cell identity?",
    short: "Model",
    description:
      "Nine model families train on the reviewed labels with leakage-safe feature selection and shared stratified data splits.",
    notes: [
      { label: "Validation winner", value: "XGBoost" },
      { label: "Best test accuracy", value: "93.2% logistic" },
      { label: "Model families", value: "9 compared" },
    ],
  },
  {
    key: "further-work",
    number: "06",
    eyebrow: "WHAT COMES NEXT",
    title: "A reference map, not the final word.",
    short: "Further work",
    description:
      "The next phase is external validation: test across donors, quantify batch effects, and compare human review with reference-based annotation.",
    notes: [
      { label: "Validate", value: "Across donors" },
      { label: "Stress-test", value: "Batch effects" },
      { label: "Extend", value: "Rare populations" },
    ],
  },
];

export const cellTypes = [
  { name: "IL7R+ memory/helper T", count: 602, color: "#6e7e4f", markers: "CD3D · IL7R · LTB" },
  { name: "Classical monocytes", count: 502, color: "#d66b4d", markers: "LYZ · S100A8 · FCN1" },
  { name: "Naive/resting T", count: 450, color: "#91a96b", markers: "CCR7 · IL7R · CD3E" },
  { name: "B cells", count: 348, color: "#5f7eb8", markers: "MS4A1 · CD79A · CD74" },
  { name: "Cytotoxic CD8 T", count: 273, color: "#b48bc5", markers: "CD8A · CCL5 · GZMK" },
  { name: "CD16+ monocytes", count: 171, color: "#8069b1", markers: "FCGR3A · LST1 · CFD" },
  { name: "NK cells", count: 153, color: "#a27a52", markers: "GNLY · NKG7 · PRF1" },
  { name: "Activated T", count: 128, color: "#d78eb7", markers: "CCL5 · GZMK · IL32" },
  { name: "Platelets", count: 11, color: "#d1ae49", markers: "PPBP · PF4 · GNG11" },
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

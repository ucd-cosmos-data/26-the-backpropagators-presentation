# PBMC3k — The Backpropagators

An interactive presentation of the team's PBMC3k single-cell RNA-sequencing
project. The site walks through the biology, quality control, exploratory
analysis, clustering, cell-type annotation, model comparison, and future work.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Main files

- `components/Presentation.tsx` — navigation and presentation pages
- `components/data.ts` — workflow, cell-type, and collaborator content
- `app/styles.css` — visual system and responsive design
- `public/` — PBMC3k figure and team images

## Navigation

- Home
- Overview
- Process
  - Preprocessing
  - EDA
  - Clustering
  - Annotation
  - Model
  - Further work
- Team

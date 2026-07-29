"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const splitLabels: Record<CellPrediction["split"], string> = {
  training: "Training",
  validation: "Validation",
  test: "Untouched test",
};

function splitNote(cell: CellPrediction) {
  if (cell.split === "test") {
    return "This cell came from the untouched test group. XGBoost did not use it for learning, tuning, or choosing the winning model, so it is the fairest kind of example.";
  }
  if (cell.split === "validation") {
    return "This cell came from the validation group. It did not teach XGBoost's trees, but it was part of the group used to compare model families, so it is not a final-test example.";
  }
  return "This cell came from the training group, so XGBoost learned from it. Its confidence may be higher than it would be for a genuinely new cell.";
}

export default function CellPredictor() {
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CellPrediction | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/data/pbmc3k-cell-predictions.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Prediction data returned ${response.status}`);
        return response.json() as Promise<PredictionPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        const initialCell = new URLSearchParams(window.location.search).get("cell");
        if (!initialCell) return;
        const initial = /^\d+$/.test(initialCell)
          ? payload.cells[Number(initialCell) - 1]
          : payload.cells.find(
              (cell) => cell.barcode.toUpperCase() === initialCell.toUpperCase(),
            );
        if (initial) {
          setQuery(String(initial.number));
          setSelected(initial);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const probabilities = useMemo(() => {
    if (!data || !selected) return [];
    return data.classes
      .map((name, index) => ({ name, value: selected.probabilities[index] }))
      .filter(({ value }) => Number((value * 100).toFixed(1)) > 0)
      .sort((left, right) => right.value - left.value);
  }, [data, selected]);

  const findCell = (value: string) => {
    if (!data) return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return data.cells[Number(trimmed) - 1];
    return data.cells.find(
      (cell) => cell.barcode.toUpperCase() === trimmed.toUpperCase(),
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cell = findCell(query);
    if (!cell) {
      setSelected(null);
      setError(
        `Cell not found. Enter a number from 1 to ${data?.cell_count.toLocaleString() ?? "2,638"} or a complete barcode.`,
      );
      return;
    }
    setError("");
    setQuery(String(cell.number));
    setSelected(cell);
  };

  const randomCell = () => {
    if (!data) return;
    const cell = data.cells[Math.floor(Math.random() * data.cells.length)];
    setError("");
    setQuery(String(cell.number));
    setSelected(cell);
  };

  const matchesReview = selected?.predicted === selected?.reviewed;

  return (
    <main className="try-page">
      <section className="try-heading">
        <div className="eyebrow"><span /> INTERACTIVE MODEL DEMO · XGBOOST</div>
        <h1>See how the model labels <em>one cell.</em></h1>
        <p>
          Choose any cell already in PBMC3k. The classifier compares that cell's
          RNA pattern with patterns learned from reviewed examples, then reports
          the most likely cell type and its level of confidence.
        </p>
      </section>

      <section className="try-console" aria-labelledby="try-console-title">
        <div className="try-console-header">
          <div>
            <span className="try-kicker">PBMC3k lookup</span>
            <h2 id="try-console-title">Choose a cell</h2>
          </div>
          <span
            className={`try-status ${data ? "ready" : loadError ? "error" : ""}`}
            role="status"
          >
            <i aria-hidden="true" />
            {data
              ? `Ready · ${data.cell_count.toLocaleString()} cells`
              : loadError
                ? "Data unavailable"
                : "Loading model results…"}
          </span>
        </div>

        <form className="try-form" onSubmit={submit} noValidate>
          <label htmlFor="cell-query">Cell number or barcode</label>
          <div className="try-input-row">
            <input
              id="cell-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try 42"
              autoComplete="off"
              aria-describedby="try-help try-error"
              aria-invalid={Boolean(error)}
              disabled={!data}
            />
            <button type="submit" disabled={!data}>Predict cell type <span>→</span></button>
          </div>
          <div className="try-form-footer">
            <span id="try-help">Use a number from 1 to 2,638, or a complete cell barcode.</span>
            <button type="button" onClick={randomCell} disabled={!data}>Pick a random cell</button>
          </div>
          {(error || loadError) && (
            <p id="try-error" className="try-error" role="alert">
              {error || "The prediction data could not be loaded. Refresh the page and try again."}
            </p>
          )}
        </form>
      </section>

      {selected && data && (
        <article className="try-result" aria-live="polite">
          <div className="try-result-summary">
            <div>
              <span className="try-kicker">XGBoost predicts</span>
              <h2>{selected.predicted}</h2>
              <p className={matchesReview ? "match" : "different"}>
                <i aria-hidden="true" />
                {matchesReview
                  ? "The prediction matches the reviewed cell label."
                  : "The prediction differs from the reviewed cell label."}
              </p>
            </div>
            <div className="try-confidence" aria-label="Prediction confidence">
              <strong>{(selected.confidence * 100).toFixed(1)}%</strong>
              <span>confidence</span>
            </div>
          </div>

          <dl className="try-facts">
            <div><dt>Cell number</dt><dd>{selected.number.toLocaleString()}</dd></div>
            <div><dt>Barcode</dt><dd title={selected.barcode}>{selected.barcode}</dd></div>
            <div><dt>Data split</dt><dd>{splitLabels[selected.split]}</dd></div>
            <div><dt>Human-reviewed label</dt><dd title={selected.reviewed}>{selected.reviewed}</dd></div>
          </dl>

          <section className="try-probabilities">
            <div className="try-section-heading">
              <h3>Possible cell types</h3>
              <span>Model probability</span>
            </div>
            <div className="try-probability-list">
              {probabilities.map(({ name, value }) => (
                <div className="try-probability" key={name}>
                  <div><span>{name}</span><strong>{(value * 100).toFixed(1)}%</strong></div>
                  <span
                    className="try-probability-track"
                    role="progressbar"
                    aria-label={name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Number((value * 100).toFixed(1))}
                  >
                    <i style={{ width: `${value * 100}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </section>

          <p className="try-split-note">{splitNote(selected)}</p>
        </article>
      )}

      <section className="try-explainer">
        <div>
          <span className="try-kicker">What's going on?</span>
          <h2>How XGBoost reaches an answer</h2>
        </div>
        <div className="try-steps">
          {[
            ["01", "Read the cell", "Retrieve the chosen cell's saved list of normalized gene-activity values."],
            ["02", "Let many small trees vote", "Each decision tree checks a series of gene-pattern questions. XGBoost combines their votes into one probability for every possible cell type."],
            ["03", "Show the possibilities", "Display the highest-probability label while keeping the other nonzero possibilities visible."],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="try-method-note">
          This page looks up predictions already calculated for PBMC3k; it does
          not process new sequencing files. The model was selected using validation
          macro-F1 and achieved 90.2% accuracy on 264 untouched test cells.
          Probability is model confidence, not biological certainty, and all cells
          came from the same donor.
        </p>
      </section>
    </main>
  );
}

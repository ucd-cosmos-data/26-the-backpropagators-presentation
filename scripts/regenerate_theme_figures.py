"""Regenerate presentation figures with the icy-blue scientific visual system.

The script reads the saved PBMC3k analysis artifacts and result tables. It
changes presentation styling only: no models are refit and no labels, scores,
coordinates, thresholds, or scientific conclusions are changed.
"""

from pathlib import Path

import anndata as ad
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score
from sklearn.mixture import GaussianMixture


PRESENTATION = Path(__file__).resolve().parents[1]
ANALYSIS = PRESENTATION.parent / "26-the-backpropagators-analysis" / "PBMC3k"
PROCESSED = ANALYSIS / "data" / "processed"
TABLES = ANALYSIS / "results" / "tables"
FIGURES = PRESENTATION / "public" / "figures"

FIGURE_BG = "#F3F9FC"
AXIS_BG = "#F8FCFE"
INK = "#173A52"
MUTED = "#557286"
GRID = "#C9DFEA"
BLUE = "#176B9E"
CYAN = "#3AAFC8"
TEAL = "#239A9A"
VIOLET = "#7766AD"
CORAL = "#D46A59"
GOLD = "#D9A441"

CLUSTER_COLORS = [
    "#246B9E",
    "#3C91C4",
    "#55B5D0",
    "#249C9D",
    "#6577B8",
    "#8A6FB7",
    "#CB6F8E",
    "#D98555",
    "#D7AA3E",
]
KMEANS_COLORS = ["#246B9E", "#42B6C8"]
CELL_TYPE_COLORS = {
    "Activated/transitional T cells": "#8A6FB7",
    "B cells": "#2F8FC3",
    "CD16+ non-classical monocytes": "#D98555",
    "Classical monocytes": "#D45F52",
    "Cytotoxic CD8 T cells": "#4E70B5",
    "IL7R+ memory/helper T cells": "#55A9D3",
    "NK cells": "#239C98",
    "Naive/resting T cells": "#81C6DC",
    "Platelets": "#D7AA3E",
}
EXPRESSION_CMAP = LinearSegmentedColormap.from_list(
    "ice_expression",
    ["#EAF6FB", "#A6DDEB", "#3AAFC8", "#155A89"],
)

DPI = 190
STARTING_CELLS = 2_700
MIN_GENES = 200
MAX_GENES = 2_500
MAX_MT_PERCENT = 5.0
PCA_COMPONENTS = 10


def configure_theme() -> None:
    sns.set_theme(style="whitegrid", context="talk")
    plt.rcParams.update(
        {
            "figure.facecolor": FIGURE_BG,
            "axes.facecolor": AXIS_BG,
            "savefig.facecolor": FIGURE_BG,
            "text.color": INK,
            "axes.labelcolor": MUTED,
            "axes.titlecolor": INK,
            "axes.edgecolor": GRID,
            "axes.grid": True,
            "grid.color": GRID,
            "grid.alpha": 0.78,
            "grid.linewidth": 0.8,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "legend.facecolor": FIGURE_BG,
            "legend.edgecolor": GRID,
            "font.family": "DejaVu Sans",
        }
    )


def save_figure(fig: plt.Figure, filename: str) -> None:
    path = FIGURES / filename
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor=FIGURE_BG)
    plt.close(fig)
    print(f"Saved {path.relative_to(PRESENTATION)}")


def category_names(labels: pd.Series) -> list[str]:
    return [str(value) for value in labels.astype("category").cat.categories]


def scatter_categories(
    axis: plt.Axes,
    coordinates: np.ndarray,
    labels: pd.Series,
    title: str,
    palette: list[str],
    *,
    legend: bool = True,
    point_size: float = 8,
) -> None:
    categories = labels.astype("category")
    names = category_names(labels)
    for name, color in zip(names, palette, strict=False):
        mask = np.asarray(categories.astype(str) == name)
        axis.scatter(
            coordinates[mask, 0],
            coordinates[mask, 1],
            s=point_size,
            alpha=0.84,
            linewidth=0,
            color=color,
            label=name,
            rasterized=True,
        )
    axis.set(title=title, xlabel="UMAP 1", ylabel="UMAP 2")
    axis.set_xticks([])
    axis.set_yticks([])
    axis.grid(False)
    if legend:
        axis.legend(
            bbox_to_anchor=(1.01, 0.5),
            loc="center left",
            frameon=False,
            fontsize=8,
            markerscale=2,
        )


def mark_selected(axis: plt.Axes, x_value: float, label: str) -> None:
    axis.axvline(x_value, color=CORAL, linestyle="--", linewidth=1.8, alpha=0.9)
    axis.text(
        x_value,
        0.98,
        label,
        color=CORAL,
        fontsize=9,
        fontweight="bold",
        ha="center",
        va="top",
        transform=axis.get_xaxis_transform(),
        bbox={"boxstyle": "round,pad=.25", "facecolor": FIGURE_BG, "edgecolor": "none"},
    )


def main() -> None:
    configure_theme()
    FIGURES.mkdir(parents=True, exist_ok=True)

    phase1 = ad.read_h5ad(PROCESSED / "pbmc3k_phase1_qc_top2000sd.h5ad")
    phase2 = ad.read_h5ad(PROCESSED / "pbmc3k_phase2_clustered.h5ad")
    phase3 = ad.read_h5ad(PROCESSED / "pbmc3k_phase3_annotated.h5ad")

    # Quality control distributions: blue measures, coral threshold decisions.
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6))
    qc_colors = [BLUE, CYAN, VIOLET]
    qc_specs = [
        ("total_counts", "Library size after QC", "UMI counts per cell"),
        ("n_genes_by_counts", "Detected genes after QC", "Genes per cell"),
        ("pct_counts_mt", "Mitochondrial RNA after QC", "Mitochondrial counts (%)"),
    ]
    for axis, color, (column, title, xlabel) in zip(axes, qc_colors, qc_specs, strict=True):
        sns.histplot(phase1.obs[column], bins=45, ax=axis, color=color, edgecolor=FIGURE_BG)
        axis.set(title=title, xlabel=xlabel, ylabel="Cells")
    axes[1].axvline(MIN_GENES, color=CORAL, linestyle="--", linewidth=1.5)
    axes[1].axvline(MAX_GENES, color=CORAL, linestyle="--", linewidth=1.5)
    axes[2].axvline(MAX_MT_PERCENT, color=CORAL, linestyle="--", linewidth=1.5)
    fig.suptitle(
        f"QC retained {phase1.n_obs:,} of {STARTING_CELLS:,} cells "
        f"({100 * phase1.n_obs / STARTING_CELLS:.1f}%)",
        y=1.03,
    )
    fig.tight_layout()
    save_figure(fig, "qc-retained-cell-distributions.png")

    # PCA and UMAP.
    variance_ratio = np.asarray(phase2.uns["pca"]["variance_ratio"])
    fig, axes = plt.subplots(1, 2, figsize=(15, 5.8), gridspec_kw={"width_ratios": [1, 1.25]})
    components = np.arange(1, min(20, len(variance_ratio)) + 1)
    axes[0].plot(
        components,
        100 * variance_ratio[: len(components)],
        marker="o",
        color=BLUE,
        markerfacecolor=CYAN,
        markeredgecolor=FIGURE_BG,
        linewidth=2.4,
    )
    axes[0].axvline(PCA_COMPONENTS, color=CORAL, linestyle="--", label="10 PCs used")
    axes[0].set(
        title="PCA variance profile",
        xlabel="Principal component",
        ylabel="Variance explained (%)",
        xticks=[1, 5, 10, 15, 20],
    )
    axes[0].legend(frameon=False)
    scatter_categories(
        axes[1],
        np.asarray(phase2.obsm["X_umap"]),
        phase2.obs["leiden"],
        "UMAP of the 15-neighbor graph",
        CLUSTER_COLORS,
    )
    fig.suptitle("From high-dimensional expression to a two-dimensional cell map", y=1.02)
    fig.tight_layout()
    save_figure(fig, "eda-pca-umap.png")

    # UMAP and t-SNE show the same communities with the same identity colors.
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    scatter_categories(
        axes[0],
        np.asarray(phase2.obsm["X_umap"]),
        phase2.obs["leiden"],
        "UMAP: local neighborhoods",
        CLUSTER_COLORS,
        legend=False,
    )
    scatter_categories(
        axes[1],
        np.asarray(phase2.obsm["X_tsne"]),
        phase2.obs["leiden"],
        "t-SNE: independent visual check",
        CLUSTER_COLORS,
    )
    axes[1].set(xlabel="t-SNE 1", ylabel="t-SNE 2")
    fig.suptitle("Two projections preserve the same broad immune-cell structure", y=1.02)
    fig.tight_layout()
    save_figure(fig, "umap-tsne-comparison.png")

    # Single Leiden reference map.
    fig, axis = plt.subplots(figsize=(8.1, 7.2))
    scatter_categories(
        axis,
        np.asarray(phase2.obsm["X_umap"]),
        phase2.obs["leiden"],
        "Nine Leiden communities at resolution 0.5",
        CLUSTER_COLORS,
        point_size=11,
    )
    fig.tight_layout()
    save_figure(fig, "leiden-clusters.png")

    # K-means versus Leiden.
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    scatter_categories(
        axes[0],
        np.asarray(phase2.obsm["X_umap"]),
        phase2.obs["kmeans"],
        "K-means: selected K = 2",
        KMEANS_COLORS,
    )
    scatter_categories(
        axes[1],
        np.asarray(phase2.obsm["X_umap"]),
        phase2.obs["leiden"],
        "Leiden: resolution 0.5, 9 communities",
        CLUSTER_COLORS,
    )
    ari = float(phase2.uns["leiden_model_selection"]["kmeans_agreement_ari"])
    fig.suptitle(f"Clustering cross-check on the same UMAP (adjusted Rand index = {ari:.3f})", y=1.02)
    fig.tight_layout()
    save_figure(fig, "clustering-kmeans-leiden-comparison.png")

    # K-means K=2 through K=10 diagnostics.
    kmeans_meta = phase2.uns["kmeans_model_selection"]
    k_values = np.asarray(kmeans_meta["k_values"])
    inertia = np.asarray(kmeans_meta["inertia"])
    silhouette = np.asarray(kmeans_meta["silhouette"])
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.3))
    for axis, values, title, ylabel in [
        (axes[0], inertia, "Elbow test: within-cluster variation", "Inertia (lower is tighter)"),
        (
            axes[1],
            silhouette,
            "Silhouette test: separation from nearby groups",
            "Silhouette score (higher is better)",
        ),
    ]:
        axis.plot(
            k_values,
            values,
            color=BLUE,
            marker="o",
            markerfacecolor=CYAN,
            markeredgecolor=FIGURE_BG,
            linewidth=2.4,
        )
        axis.set(title=title, xlabel="Number of K-means clusters (K)", ylabel=ylabel, xticks=k_values)
    axes[0].axvline(
        int(kmeans_meta["geometric_elbow_k"]),
        color=CORAL,
        linestyle="--",
        label=f"geometric elbow: K={int(kmeans_meta['geometric_elbow_k'])}",
    )
    axes[0].axvline(
        int(kmeans_meta["selected_k"]),
        color=TEAL,
        linestyle=":",
        linewidth=2,
        label=f"selected broad solution: K={int(kmeans_meta['selected_k'])}",
    )
    axes[0].legend(frameon=False, fontsize=9)
    axes[1].scatter([k_values[0]], [silhouette[0]], color=GOLD, s=72, zorder=4)
    fig.suptitle("K-means was tested from K=2 through K=10", y=1.04)
    fig.tight_layout()
    save_figure(fig, "kmeans-k2-k10-diagnostics.png")

    # Leiden resolution sensitivity.
    leiden_meta = phase2.uns["leiden_model_selection"]
    resolutions = np.asarray(leiden_meta["resolutions"])
    selected_resolution = float(leiden_meta["selected_resolution"])
    panels = [
        ("cluster_counts", "Communities found", "Count", False),
        ("silhouette", "Separation", "Silhouette score", True),
        ("stability_ari", "Repeat-run stability", "Adjusted Rand index", True),
        ("max_qc_eta_squared", "Association with technical QC", "Maximum eta-squared", False),
    ]
    fig, axes = plt.subplots(2, 2, figsize=(14, 9.2))
    for axis, (key, title, ylabel, higher_is_better) in zip(axes.flat, panels, strict=True):
        values = np.asarray(leiden_meta[key])
        axis.plot(
            resolutions,
            values,
            color=BLUE,
            marker="o",
            markerfacecolor=CYAN,
            markeredgecolor=FIGURE_BG,
            linewidth=2.4,
        )
        mark_selected(axis, selected_resolution, "selected 0.5")
        selected_index = int(np.argmin(np.abs(resolutions - selected_resolution)))
        axis.scatter(
            [selected_resolution],
            [values[selected_index]],
            color=CORAL,
            s=76,
            zorder=5,
            edgecolor=FIGURE_BG,
        )
        axis.set(title=title, xlabel="Leiden resolution", ylabel=ylabel, xticks=resolutions)
        if higher_is_better:
            axis.text(
                0.02,
                0.95,
                "higher is better",
                transform=axis.transAxes,
                color=MUTED,
                fontsize=9,
                va="top",
            )
    fig.suptitle(
        "Leiden sensitivity check: resolution 0.5 was the nine-community reference",
        y=1.01,
    )
    fig.tight_layout()
    save_figure(fig, "leiden-resolution-diagnostics.png")

    # Exploratory alternatives, refit only for presentation comparison.
    pca_coordinates = np.asarray(
        phase2.obsm["X_pca"],
        dtype=np.float64,
    )[:, :PCA_COMPONENTS]
    leiden_labels = phase2.obs["leiden"].astype(str)
    agglomerative_labels = AgglomerativeClustering(n_clusters=9).fit_predict(pca_coordinates)
    gaussian_labels = GaussianMixture(
        n_components=9,
        covariance_type="diag",
        n_init=5,
        random_state=42,
    ).fit_predict(pca_coordinates)
    agglomerative_ari = adjusted_rand_score(leiden_labels, agglomerative_labels)
    gaussian_ari = adjusted_rand_score(leiden_labels, gaussian_labels)
    alternatives = [
        (phase2.obs["kmeans"], "K-means (K=2): broad reference", KMEANS_COLORS),
        (
            pd.Series(agglomerative_labels, index=phase2.obs_names).astype("category"),
            f"Agglomerative (K=9): ARI to Leiden {agglomerative_ari:.2f}",
            CLUSTER_COLORS,
        ),
        (
            pd.Series(gaussian_labels, index=phase2.obs_names).astype("category"),
            f"Gaussian mixture (K=9): ARI to Leiden {gaussian_ari:.2f}",
            CLUSTER_COLORS,
        ),
        (phase2.obs["leiden"], "Leiden (resolution 0.5): final reference", CLUSTER_COLORS),
    ]
    fig, axes = plt.subplots(2, 2, figsize=(14, 11))
    for axis, (labels, title, palette) in zip(axes.flat, alternatives, strict=True):
        scatter_categories(
            axis,
            np.asarray(phase2.obsm["X_umap"]),
            labels,
            title,
            palette,
            legend=False,
            point_size=6.5,
        )
    fig.suptitle(
        "Exploratory clustering alternatives on the same cells\n"
        "Agglomerative and Gaussian-mixture labels were not used for annotation",
        y=1.01,
    )
    fig.tight_layout()
    save_figure(fig, "alternative-clustering-methods.png")

    # Marker-gene dot plot.
    marker_map = {
        "Cytotoxic CD8 T": ["CD8A", "CCL5"],
        "B": ["MS4A1", "CD79A"],
        "Memory/helper T": ["IL7R", "LTB"],
        "Classical mono.": ["S100A8", "FCN1"],
        "CD16+ mono.": ["FCGR3A", "LST1"],
        "NK": ["GNLY", "NKG7"],
        "Activated T": ["GZMK", "IL32"],
        "Naive T": ["CCR7", "MAL"],
        "Platelet": ["PPBP", "PF4"],
    }
    marker_genes = [gene for genes in marker_map.values() for gene in genes]
    expression = phase3.raw[:, marker_genes].X
    if hasattr(expression, "toarray"):
        expression = expression.toarray()
    expression = np.asarray(expression)
    labels = phase3.obs["cell_type"].astype(str).reset_index(drop=True)
    cell_type_order = (
        phase3.obs.groupby("cell_type", observed=True).size().sort_values(ascending=False).index.tolist()
    )
    mean_expression = pd.DataFrame(expression, columns=marker_genes).groupby(labels).mean()
    fraction_expressing = pd.DataFrame(expression > 0, columns=marker_genes).groupby(labels).mean()
    mean_expression = mean_expression.loc[cell_type_order]
    fraction_expressing = fraction_expressing.loc[cell_type_order]
    scaled_mean = (mean_expression - mean_expression.min()) / (
        mean_expression.max() - mean_expression.min()
    ).replace(0, 1)
    fig, axis = plt.subplots(figsize=(15, 6.8))
    for row, cell_type in enumerate(cell_type_order):
        for column, gene in enumerate(marker_genes):
            axis.scatter(
                column,
                row,
                s=30 + 310 * fraction_expressing.loc[cell_type, gene],
                c=scaled_mean.loc[cell_type, gene],
                cmap=EXPRESSION_CMAP,
                vmin=0,
                vmax=1,
                edgecolor="none",
            )
    axis.set(
        title="Known marker programs support the reviewed cell-type labels",
        xlabel="Marker gene",
        ylabel="Reviewed cell type",
        xticks=np.arange(len(marker_genes)),
        xticklabels=marker_genes,
        yticks=np.arange(len(cell_type_order)),
        yticklabels=cell_type_order,
    )
    axis.tick_params(axis="x", rotation=45)
    axis.invert_yaxis()
    axis.grid(False)
    for boundary in np.cumsum([len(genes) for genes in marker_map.values()])[:-1] - 0.5:
        axis.axvline(boundary, color=GRID, linewidth=0.9)
    size_handles = [
        axis.scatter([], [], s=30 + 310 * fraction, color=CYAN, label=f"{int(100*fraction)}%")
        for fraction in (0.25, 0.5, 0.75)
    ]
    axis.legend(
        handles=size_handles,
        title="Cells expressing",
        bbox_to_anchor=(1.01, 0.5),
        loc="center left",
        frameon=False,
    )
    fig.tight_layout()
    save_figure(fig, "annotation-marker-dotplot.png")

    # Classification class balance with stable biological identity colors.
    class_counts = phase3.obs["cell_type"].astype(str).value_counts().sort_values(ascending=True)
    fig, axis = plt.subplots(figsize=(10, 5.2))
    axis.barh(
        class_counts.index,
        class_counts.values,
        color=[CELL_TYPE_COLORS[name] for name in class_counts.index],
        edgecolor=FIGURE_BG,
    )
    axis.set(title="Reviewed cell-type class balance", xlabel="Cells", ylabel="Cell type")
    axis.grid(axis="y", visible=False)
    fig.tight_layout()
    save_figure(fig, "classification-class-balance.png")

    # Validation/test model comparison with metric-family color semantics.
    comparison = pd.read_csv(TABLES / "classification_model_comparison.csv").sort_values("rank")
    metric_specs = [
        ("validation_macro_f1", "Validation macro-F1", BLUE),
        ("validation_roc_auc_ovr_macro", "Validation ROC AUC", "#72B9D8"),
        ("test_macro_f1", "Test macro-F1", TEAL),
        ("test_roc_auc_ovr_macro", "Test ROC AUC", VIOLET),
    ]
    x_positions = np.arange(len(comparison))
    width = 0.2
    fig, axis = plt.subplots(figsize=(14, 6))
    for index, (column, label, color) in enumerate(metric_specs):
        axis.bar(
            x_positions + (index - 1.5) * width,
            comparison[column],
            width=width,
            label=label,
            color=color,
            edgecolor=FIGURE_BG,
        )
    axis.set(
        title="Validation-selected model comparison with untouched-test estimates",
        ylabel="Score",
        ylim=(0, 1.05),
        xticks=x_positions,
        xticklabels=comparison["model"],
    )
    axis.tick_params(axis="x", rotation=35)
    for label in axis.get_xticklabels():
        label.set_horizontalalignment("right")
    axis.legend(loc="lower left", ncol=2, frameon=True)
    fig.tight_layout()
    save_figure(fig, "classification-model-comparison.png")

    # Training-only selected genes.
    feature_scores = pd.read_csv(TABLES / "classification_selected_gene_scores.csv")
    top_features = feature_scores.head(25).sort_values("training_f_score")
    normalized = (top_features["training_f_score"] - top_features["training_f_score"].min()) / (
        top_features["training_f_score"].max() - top_features["training_f_score"].min()
    )
    bar_colors = EXPRESSION_CMAP(0.38 + 0.62 * normalized)
    fig, axis = plt.subplots(figsize=(9, 7))
    axis.barh(top_features["gene"], top_features["training_f_score"], color=bar_colors)
    axis.set(
        xlabel="Training-only ANOVA F score",
        ylabel="Gene",
        title="Highest-scoring selected genes: XGBoost",
    )
    axis.grid(axis="y", visible=False)
    fig.tight_layout()
    save_figure(fig, "classification-top-selected-genes.png")

    print(
        "Kept classification-confusion-matrix.png unchanged: its sequential blue "
        "colormap already matches the theme and correctly represents normalized intensity."
    )


if __name__ == "__main__":
    main()

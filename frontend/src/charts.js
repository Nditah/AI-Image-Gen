/** Chart.js loader + colourful palette for academic report screenshots. */

const CHART_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js";

export const CHART_COLORS = [
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#22c55e", // green
  "#f97316", // orange
  "#ec4899", // pink
  "#6366f1", // indigo
  "#84cc16", // lime
];

export const VERDICT_COLORS = {
  UP: "#16a34a",
  DOWN: "#e11d48",
};

export const SAFETY_COLORS = {
  ALLOWED: "#16a34a",
  BLOCKED: "#e11d48",
  FLAGGED: "#d97706",
  REMOVED: "#64748b",
  PENDING: "#0ea5e9",
  UNKNOWN: "#94a3b8",
};

let chartPromise = null;

export function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartPromise) return chartPromise;
  chartPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
    if (existing && window.Chart) {
      resolve(window.Chart);
      return;
    }
    const script = document.createElement("script");
    script.src = CHART_CDN;
    script.async = true;
    script.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error("Chart.js failed to load"));
    };
    script.onerror = () => reject(new Error("Could not load Chart.js from CDN"));
    document.head.appendChild(script);
  });
  return chartPromise;
}

export function destroyCharts(charts) {
  (charts || []).forEach((chart) => {
    try {
      chart?.destroy?.();
    } catch {
      // ignore
    }
  });
}

function baseOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, usePointStyle: true, padding: 14 },
      },
      title: {
        display: Boolean(title),
        text: title || "",
        font: { size: 14, weight: "600" },
        color: "#1e3a5f",
        padding: { bottom: 12 },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        padding: 10,
        cornerRadius: 8,
      },
    },
  };
}

export function makeDoughnut(Chart, canvas, labels, values, colors, title) {
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      ...baseOptions(title),
      cutout: "58%",
    },
  });
}

export function makeBar(Chart, canvas, labels, values, colors, title, { horizontal = false } = {}) {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title || "Count",
          data: values,
          backgroundColor: colors,
          borderRadius: 8,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      ...baseOptions(null),
      indexAxis: horizontal ? "y" : "x",
      plugins: {
        ...baseOptions(title).plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: { color: "#475569" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: { color: "#475569", precision: 0 },
        },
      },
    },
  });
}

export function makeGroupedBar(Chart, canvas, labels, datasets, title) {
  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      ...baseOptions(title),
      scales: {
        x: {
          stacked: false,
          grid: { display: false },
          ticks: { color: "#475569" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: { color: "#475569", precision: 0 },
        },
      },
    },
  });
}

export function makeLine(Chart, canvas, labels, values, title) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Generations",
          data: values,
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: labels.length > 45 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      ...baseOptions(title),
      plugins: {
        ...baseOptions(title).plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: { color: "#475569", precision: 0 },
        },
      },
    },
  });
}

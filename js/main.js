import { createPopulationChart } from "./population.js";
import { createCitizenshipChart } from "./citizenship.js";
import { createLabourChart } from "./labour.js";
import { createEducationChart } from "./education.js";

const d3 = window.d3;

export const CHART_WIDTH = 560;
export const CHART_HEIGHT = 320;
export const MARGIN = { top: 56, right: 28, bottom: 54, left: 68 };
export const TRANSITION_MS = 500;

export const COLORS = {
  icelandic: "#166534",
  foreign: "#c2410c",
  tertiary: "#0f766e",
  non_tertiary: "#b45309",
  line: "#1d4ed8",
  highlight: "#111827",
  selection: "#dc2626",
};

export const LABELS = {
  icelandic: "Icelandic background",
  foreign: "Foreign background",
  tertiary: "Tertiary",
  non_tertiary: "Non-tertiary",
};

export const state = {
  years: [],
  selectedYear: 2016,
  selectedGroup: null,
  selectedEducationLevel: null,
  timelineLabelVisible: false,
  data: {
    population: [],
    citizenship: [],
    labour: [],
    education: [],
  },
};

export const tooltip = d3.select("#tooltip");

const chartUpdaters = [];
let timeline = null;

export function registerUpdater(updateFn) {
  chartUpdaters.push(updateFn);
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function pickField(row, aliases, fallback = undefined) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

export function getRowForYear(rows, year) {
  const exact = rows.find((d) => d.year === year);
  if (exact) {
    return exact;
  }

  if (!rows.length) {
    return null;
  }

  return rows.reduce((closest, row) => {
    const currentDelta = Math.abs(row.year - year);
    const bestDelta = Math.abs(closest.year - year);
    return currentDelta < bestDelta ? row : closest;
  }, rows[0]);
}

export function showTooltip(event, html) {
  tooltip
    .attr("aria-hidden", "false")
    .style("opacity", 1)
    .html(html)
    .style("left", `${event.pageX + 14}px`)
    .style("top", `${event.pageY - 28}px`);
}

export function hideTooltip() {
  tooltip.attr("aria-hidden", "true").style("opacity", 0);
}

export function clearFilters() {
  state.selectedGroup = null;
  state.selectedEducationLevel = null;
  updateAllCharts();
}

export function setSelectedYear(year, options = {}) {
  const { force = false, revealTimelineLabel = false } = options;
  const boundedYear = Math.max(d3.min(state.years), Math.min(d3.max(state.years), year));

  if (revealTimelineLabel) {
    state.timelineLabelVisible = true;
  }

  if (!force && state.selectedYear === boundedYear) {
    return;
  }

  state.selectedYear = boundedYear;
  d3.select("#year-slider").property("value", boundedYear);
  d3.select("#year-value").text(boundedYear);
  updateAllCharts();
}

export function setSelectedGroup(group) {
  state.selectedGroup = state.selectedGroup === group ? null : group;
  state.selectedEducationLevel = null;
  updateAllCharts();
}

export function toggleEducationSelection(group, level) {
  const sameGroup = state.selectedGroup === group;
  const sameLevel = state.selectedEducationLevel === level;

  if (sameGroup && sameLevel) {
    clearFilters();
    return;
  }

  state.selectedGroup = group;
  state.selectedEducationLevel = level;
  updateAllCharts();
}

export function isGroupMatch(group) {
  return !state.selectedGroup || state.selectedGroup === group;
}

export function isEducationMatch(level) {
  return !state.selectedEducationLevel || state.selectedEducationLevel === level;
}

export function getSelectionOpacity(group = null, level = null, dimmed = 0.18) {
  const groupMatch = group === null || isGroupMatch(group);
  const levelMatch = level === null || isEducationMatch(level);
  return groupMatch && levelMatch ? 1 : dimmed;
}

function updateFilterStatus() {
  const status = [
    `Year: ${state.selectedYear}`,
    `Group: ${state.selectedGroup ? LABELS[state.selectedGroup] : "All backgrounds"}`,
    `Education: ${state.selectedEducationLevel ? LABELS[state.selectedEducationLevel] : "All levels"}`,
  ];

  d3.select("#filter-status").text(status.join(" | "));
  d3.select("#clear-filters").attr(
    "disabled",
    state.selectedGroup === null && state.selectedEducationLevel === null ? true : null
  );
}

function renderTimelineSelector() {
  const slider = d3.select("#year-slider");
  const output = d3.select("#year-value");
  slider.classed("visually-hidden", true);
  output.classed("visually-hidden", true);

  const wrap = d3.select("#year-timeline-wrap");
  wrap.selectAll("*").remove();

  const width = Math.max(440, Math.floor(wrap.node().getBoundingClientRect().width || 640));
  const height = 68;
  const padding = 24;
  const x = d3.scalePoint().domain(state.years).range([padding, width - padding]);

  const svg = wrap
    .append("svg")
    .attr("class", "year-timeline")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg
    .append("line")
    .attr("class", "timeline-track")
    .attr("x1", padding)
    .attr("x2", width - padding)
    .attr("y1", 34)
    .attr("y2", 34);

  const nodes = svg
    .append("g")
    .attr("class", "timeline-nodes")
    .selectAll("circle")
    .data(state.years)
    .join("circle")
    .attr("class", "timeline-node")
    .attr("cx", (d) => x(d))
    .attr("cy", 34)
    .attr("r", 6)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `Select year ${d}`)
    .on("click", (_, d) => setSelectedYear(d, { revealTimelineLabel: true, force: true }))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedYear(d, { revealTimelineLabel: true, force: true });
      }
    });

  const labels = svg
    .append("g")
    .attr("class", "timeline-labels")
    .selectAll("text")
    .data(state.years)
    .join("text")
    .attr("class", "timeline-year-label")
    .attr("x", (d) => x(d))
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .style("opacity", 0)
    .text((d) => d);

  timeline = { nodes, labels };
}

function updateTimelineSelector() {
  if (!timeline) {
    return;
  }

  timeline.nodes
    .classed("is-selected", (d) => d === state.selectedYear)
    .transition()
    .duration(220)
    .attr("r", (d) => (d === state.selectedYear ? 8 : 6));

  timeline.labels
    .transition()
    .duration(220)
    .style("opacity", (d) => (state.timelineLabelVisible && d === state.selectedYear ? 1 : 0));
}

function buildEducationRows() {
  return state.years
    .map((year) => {
      const citizenship = getRowForYear(state.data.citizenship, year);
      const education = getRowForYear(state.data.education, year);
      const educationYear = education ? education.year : null;
      const tertiaryShare = education ? education.tertiary_share_25_64_total / 100 : 0;

      return ["icelandic", "foreign"].map((group) => {
        const population = citizenship ? citizenship[group] : 0;
        const tertiary = population * tertiaryShare;
        const nonTertiary = Math.max(0, population - tertiary);
        return {
          year,
          educationYear,
          group,
          levels: [
            { level: "tertiary", value: tertiary },
            { level: "non_tertiary", value: nonTertiary },
          ],
        };
      });
    })
    .flat();
}

function updateInsights() {
  const year = state.selectedYear;
  const population = getRowForYear(state.data.population, year);
  const previousPopulation = getRowForYear(state.data.population, year - 1);
  const citizenship = getRowForYear(state.data.citizenship, year);
  const labour = getRowForYear(state.data.labour, year);
  const education = getRowForYear(state.data.education, year);

  const totalChange = previousPopulation ? population.total_population - previousPopulation.total_population : 0;
  const foreignShare = ((citizenship.foreign / (citizenship.icelandic + citizenship.foreign)) * 100).toFixed(1);
  const tertiaryShare = education ? education.tertiary_share_25_64_total.toFixed(1) : "n/a";

  const cards = [
    {
      title: `${year} population snapshot`,
      body: `${d3.format(",")(population.total_population)} residents, ${totalChange >= 0 ? "+" : ""}${d3.format(",")(totalChange)} from the previous year.`,
    },
    {
      title: "Citizenship mix",
      body: `Foreign-background residents account for ${foreignShare}% of the total population in ${year}.`,
    },
    {
      title: "Labour and education context",
      body: `Labour shares are ${labour.icelandic_share.toFixed(1)}% vs ${labour.foreign_share.toFixed(1)}%. The national tertiary share is ${tertiaryShare}% for ages 25-64.`,
    },
  ];

  d3.select("#insights")
    .selectAll("article")
    .data(cards)
    .join("article")
    .attr("class", "insight-card")
    .html((d) => `<h3>${d.title}</h3><p>${d.body}</p>`);
}

function updateInsightSummary() {
  const year = state.selectedYear;
  const baselineYear = d3.min(state.years);
  const population = getRowForYear(state.data.population, year);
  const baselinePopulation = getRowForYear(state.data.population, baselineYear);
  const citizenship = getRowForYear(state.data.citizenship, year);
  const labour = getRowForYear(state.data.labour, year);
  const education = getRowForYear(state.data.education, year);
  const educationReferenceYear = education ? education.year : year;

  const populationChange = population.total_population - baselinePopulation.total_population;
  const foreignShare = (citizenship.foreign / (citizenship.icelandic + citizenship.foreign)) * 100;
  const labourGap = labour.icelandic_share - labour.foreign_share;
  const filterSentence = state.selectedGroup
    ? `The current group filter highlights ${LABELS[state.selectedGroup]}${state.selectedEducationLevel ? ` with ${LABELS[state.selectedEducationLevel].toLowerCase()} structure` : ""}.`
    : "No persistent group filter is active, so the summary describes the full dashboard state.";
  const educationSentence =
    educationReferenceYear !== year
      ? `Education structure in ${year} uses the latest available rate from ${educationReferenceYear}.`
      : `Education structure uses the ${year} national tertiary rate.`;

  const summary =
    `By ${year}, Iceland's population is ${d3.format(",")(populationChange)} higher than in ${baselineYear}, reaching ${d3.format(",")(population.total_population)}. ` +
    `Foreign-background residents represent ${foreignShare.toFixed(1)}% of the total population, while the labour participation gap between Icelandic and foreign backgrounds is ${Math.abs(labourGap).toFixed(1)} percentage points. ` +
    `${educationSentence} ${filterSentence}`;

  d3.select("#insight-summary-body").text(summary);
}

export function updateAllCharts() {
  updateTimelineSelector();
  updateFilterStatus();
  chartUpdaters.forEach((updateFn) => updateFn());
  updateInsights();
  updateInsightSummary();
}

async function loadData() {
  const [population, citizenship, labour, education] = await Promise.all([
    d3.csv("data/population_year.csv", (d) => ({
      year: toNumber(pickField(d, ["year"]), NaN),
      total_population: toNumber(pickField(d, ["total_population", "population_total"]), 0),
    })),
    d3.csv("data/citizenship_year.csv", (d) => ({
      year: toNumber(pickField(d, ["year"]), NaN),
      icelandic: toNumber(pickField(d, ["icelandic_background", "icelandic"]), 0),
      foreign: toNumber(pickField(d, ["foreign_background", "foreign"]), 0),
    })),
    d3.csv("data/labour_share_year.csv", (d) => ({
      year: toNumber(pickField(d, ["year"]), NaN),
      icelandic_share: toNumber(pickField(d, ["icelandic_share", "icelandic_labour_share"]), 0),
      foreign_share: toNumber(pickField(d, ["foreign_share", "foreign_labour_share"]), 0),
    })),
    d3.csv("data/education_year.csv", (d) => ({
      year: toNumber(pickField(d, ["year"]), NaN),
      tertiary_share_25_64_total: toNumber(pickField(d, ["tertiary_share_25_64_total", "tertiary_share"]), 0),
    })),
  ]);

  state.data.population = population.filter((d) => Number.isFinite(d.year)).sort((a, b) => a.year - b.year);
  state.data.citizenship = citizenship.filter((d) => Number.isFinite(d.year)).sort((a, b) => a.year - b.year);
  state.data.labour = labour.filter((d) => Number.isFinite(d.year)).sort((a, b) => a.year - b.year);
  state.data.education = education.filter((d) => Number.isFinite(d.year)).sort((a, b) => a.year - b.year);
  state.years = state.data.population.map((d) => d.year);
  state.selectedYear = d3.min(state.years);

  renderTimelineSelector();
  createPopulationChart(state.data.population);
  createCitizenshipChart(state.data.citizenship);
  createLabourChart(state.data.labour);
  createEducationChart(buildEducationRows());

  d3.select("#year-slider")
    .attr("min", d3.min(state.years))
    .attr("max", d3.max(state.years))
    .property("value", state.selectedYear)
    .on("input", function () {
      setSelectedYear(toNumber(this.value, state.selectedYear), { revealTimelineLabel: true, force: true });
    });

  d3.select("#year-value").text(state.selectedYear);
  d3.select("#clear-filters").on("click", clearFilters);

  updateAllCharts();
}

loadData().catch((error) => {
  console.error("Failed to initialize dashboard", error);
  d3.select("body")
    .append("p")
    .attr("class", "error-text")
    .text(`Failed to load one or more datasets. ${error.message}`);
});

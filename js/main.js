import { createPopulationChart } from "./population.js";
import { createCitizenshipChart } from "./citizenship.js";
import { createLabourChart } from "./labour.js";
import { createEducationChart } from "./education.js";
import { createPulseChart } from "./pulse.js";

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
  areaMode: "absolute",
  timelineLabelVisible: false,
  storyPlaying: false,
  storyTimer: null,
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
  return rows.find((d) => d.year === year) || null;
}

export function getNearestRowForYear(rows, year) {
  const exact = getRowForYear(rows, year);
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

export function formatSignedNumber(value) {
  return `${value >= 0 ? "+" : ""}${d3.format(",")(value)}`;
}

export function formatSignedPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} percentage points`;
}

export function formatAreaValue(value, mode) {
  return mode === "percent" ? `${value.toFixed(1)}%` : d3.format(",")(value);
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

function stopStoryMode() {
  if (state.storyTimer) {
    clearInterval(state.storyTimer);
    state.storyTimer = null;
  }
  state.storyPlaying = false;
  d3.select("#story-toggle").text("Play story").attr("aria-pressed", "false");
  d3.select("#story-badge").classed("is-playing", false).text("Story mode idle");
}

export function setSelectedYear(year, options = {}) {
  const { force = false, revealTimelineLabel = false, preserveStory = false } = options;
  const boundedYear = Math.max(d3.min(state.years), Math.min(d3.max(state.years), year));

  if (revealTimelineLabel) {
    state.timelineLabelVisible = true;
  }

  if (!force && state.selectedYear === boundedYear) {
    return;
  }

  if (!preserveStory && state.storyPlaying) {
    stopStoryMode();
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

function toggleAreaMode() {
  state.areaMode = state.areaMode === "absolute" ? "percent" : "absolute";
  const isPercent = state.areaMode === "percent";
  d3.select("#area-mode-toggle")
    .classed("is-active", isPercent)
    .attr("aria-pressed", isPercent ? "true" : "false")
    .text(isPercent ? "Show counts" : "Show percentage");
  updateAllCharts();
}

function buildCoverageSummary() {
  const datasets = [
    { name: "Population", rows: state.data.population },
    { name: "Citizenship", rows: state.data.citizenship },
    { name: "Labour", rows: state.data.labour },
    { name: "Education", rows: state.data.education },
  ];

  const maxYear = d3.max(state.years);
  const notes = datasets.map((dataset) => {
    const firstYear = d3.min(dataset.rows, (d) => d.year);
    const lastYear = d3.max(dataset.rows, (d) => d.year);
    return `${dataset.name}: ${firstYear}-${lastYear}`;
  });

  const educationLastYear = d3.max(state.data.education, (d) => d.year);
  if (educationLastYear < maxYear) {
    notes.push(`Education data ends in ${educationLastYear}, so ${educationLastYear + 1}-${maxYear} uses the same rate.`);
  }

  return notes.join(" | ");
}

function getDerivedStats(year) {
  const baselineYear = d3.min(state.years);
  const population = getRowForYear(state.data.population, year);
  const baselinePopulation = getRowForYear(state.data.population, baselineYear);
  const previousPopulation = getRowForYear(state.data.population, year - 1);
  const citizenship = getRowForYear(state.data.citizenship, year);
  const labour = getRowForYear(state.data.labour, year);
  const education = getRowForYear(state.data.education, year) || getNearestRowForYear(state.data.education, year);

  const populationChange = population.total_population - baselinePopulation.total_population;
  const yearChange = previousPopulation ? population.total_population - previousPopulation.total_population : 0;
  const totalCitizenship = citizenship.icelandic + citizenship.foreign;
  const foreignShare = totalCitizenship ? (citizenship.foreign / totalCitizenship) * 100 : 0;
  const labourGap = labour.icelandic_share - labour.foreign_share;
  const tertiaryRate = education ? education.tertiary_share_25_64_total : 0;
  const tertiaryEstimate = citizenship.foreign * (tertiaryRate / 100);
  const educationReferenceYear = education ? education.year : year;

  return {
    baselineYear,
    population,
    populationChange,
    yearChange,
    citizenship,
    foreignShare,
    labour,
    labourGap,
    tertiaryRate,
    tertiaryEstimate,
    educationReferenceYear,
  };
}

function getStoryMilestones() {
  const populationData = state.data.population;
  const citizenshipData = state.data.citizenship;
  const labourData = state.data.labour;
  const educationData = state.data.education;
  const baselineYear = d3.min(state.years);

  const highestPopulation = populationData.reduce((best, row) =>
    row.total_population > best.total_population ? row : best
  , populationData[0]);

  const largestIncrease = populationData
    .slice(1)
    .map((row, index) => ({
      year: row.year,
      delta: row.total_population - populationData[index].total_population,
    }))
    .reduce((best, row) => (row.delta > best.delta ? row : best));

  const highestForeignShare = citizenshipData
    .map((row) => ({
      year: row.year,
      value: (row.foreign / (row.icelandic + row.foreign)) * 100,
    }))
    .reduce((best, row) => (row.value > best.value ? row : best));

  const narrowestLabourGap = labourData
    .map((row) => ({
      year: row.year,
      value: Math.abs(row.icelandic_share - row.foreign_share),
    }))
    .reduce((best, row) => (row.value < best.value ? row : best));

  const highestTertiaryRate = educationData.reduce((best, row) =>
    row.tertiary_share_25_64_total > best.tertiary_share_25_64_total ? row : best
  , educationData[0]);

  return { baselineYear, highestPopulation, largestIncrease, highestForeignShare, narrowestLabourGap, highestTertiaryRate };
}

function updateMetricStrip() {
  const stats = getDerivedStats(state.selectedYear);
  const cards = [
    {
      title: `Growth Since ${stats.baselineYear}`,
      value: formatSignedNumber(stats.populationChange),
      detail: `Total population reached ${d3.format(",")(stats.population.total_population)} in ${state.selectedYear}.`,
    },
    {
      title: "Foreign-Background Share",
      value: `${stats.foreignShare.toFixed(1)}%`,
      detail: `${d3.format(",")(stats.citizenship.foreign)} of ${d3.format(",")(stats.citizenship.icelandic + stats.citizenship.foreign)} residents.`,
    },
    {
      title: "Labour Participation Gap",
      value: formatSignedPercent(stats.labourGap),
      detail: `Icelandic: ${stats.labour.icelandic_share.toFixed(1)}% | Foreign: ${stats.labour.foreign_share.toFixed(1)}%`,
    },
    {
      title: "Estimated Foreign Tertiary Count",
      value: d3.format(",.0f")(stats.tertiaryEstimate),
      detail:
        stats.educationReferenceYear !== state.selectedYear
          ? `Uses the latest available tertiary rate from ${stats.educationReferenceYear}.`
          : `Based on the ${state.selectedYear} national tertiary share (${stats.tertiaryRate.toFixed(1)}%).`,
    },
  ];

  d3.select("#metric-strip")
    .selectAll("article")
    .data(cards)
    .join("article")
    .attr("class", "metric-card")
    .html((d) => `<h3>${d.title}</h3><span class="metric-value">${d.value}</span><p class="metric-detail">${d.detail}</p>`);
}

function updateStoryPanel() {
  const year = state.selectedYear;
  const stats = getDerivedStats(year);
  const milestones = getStoryMilestones();
  const notes = [];

  if (year === milestones.baselineYear) {
    notes.push("This is the baseline year used for all comparisons across the dashboard.");
  }
  if (year === milestones.largestIncrease.year) {
    notes.push(`This year records the sharpest annual population increase in the series: ${formatSignedNumber(milestones.largestIncrease.delta)}.`);
  }
  if (year === milestones.highestPopulation.year) {
    notes.push(`This is the population peak in the available data at ${d3.format(",")(stats.population.total_population)} residents.`);
  }
  if (year === milestones.highestForeignShare.year) {
    notes.push(`Foreign-background share reaches its highest observed level here at ${stats.foreignShare.toFixed(1)}%.`);
  }
  if (year === milestones.narrowestLabourGap.year) {
    notes.push(`The labour participation gap is narrowest here at ${Math.abs(stats.labourGap).toFixed(1)} percentage points.`);
  }
  if (year === milestones.highestTertiaryRate.year) {
    notes.push(`The national tertiary education rate is highest here at ${stats.tertiaryRate.toFixed(1)}%.`);
  }
  if (stats.educationReferenceYear !== year) {
    notes.push(`Education uses the latest available rate from ${stats.educationReferenceYear} for this year.`);
  }
  if (!notes.length) {
    notes.push(
      `Relative to ${stats.baselineYear}, the population is ${formatSignedNumber(stats.populationChange)} and foreign-background share is ${stats.foreignShare.toFixed(1)}%.`
    );
  }

  d3.select("#story-panel-body").text(notes.join(" "));
  d3.select("#story-badge")
    .classed("is-playing", state.storyPlaying)
    .text(state.storyPlaying ? `Story mode playing: ${year}` : `Focused year: ${year}`);
}

function toggleStoryMode() {
  if (state.storyPlaying) {
    stopStoryMode();
    return;
  }

  state.storyPlaying = true;
  d3.select("#story-toggle").text("Pause story").attr("aria-pressed", "true");
  d3.select("#story-badge").classed("is-playing", true).text(`Story mode playing: ${state.selectedYear}`);

  state.storyTimer = setInterval(() => {
    const currentIndex = state.years.indexOf(state.selectedYear);
    const nextIndex = currentIndex === state.years.length - 1 ? 0 : currentIndex + 1;
    setSelectedYear(state.years[nextIndex], { revealTimelineLabel: true, force: true, preserveStory: true });
  }, 1700);
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
      const education = getRowForYear(state.data.education, year) || getNearestRowForYear(state.data.education, year);
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
  const stats = getDerivedStats(year);
  const tertiaryShare = Number.isFinite(stats.tertiaryRate) ? stats.tertiaryRate.toFixed(1) : "n/a";

  const cards = [
    {
      title: `${year} population snapshot`,
      body: `${d3.format(",")(stats.population.total_population)} residents, ${formatSignedNumber(stats.yearChange)} from the previous year.`,
    },
    {
      title: "Citizenship mix",
      body: `Foreign-background residents account for ${stats.foreignShare.toFixed(1)}% of the total population in ${year}.`,
    },
    {
      title: "Labour and education context",
      body: `Labour shares are ${stats.labour.icelandic_share.toFixed(1)}% vs ${stats.labour.foreign_share.toFixed(1)}%. The national tertiary share is ${tertiaryShare}% for ages 25-64.`,
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
  const stats = getDerivedStats(year);
  const filterSentence = state.selectedGroup
    ? `The current group filter highlights ${LABELS[state.selectedGroup]}${state.selectedEducationLevel ? ` with ${LABELS[state.selectedEducationLevel].toLowerCase()} structure` : ""}.`
    : "No persistent group filter is active, so the summary describes the full dashboard state.";
  const educationSentence =
    stats.educationReferenceYear !== year
      ? `Education structure in ${year} uses the latest available rate from ${stats.educationReferenceYear}.`
      : `Education structure uses the ${year} national tertiary rate.`;

  const summary =
    `By ${year}, Iceland's population is ${d3.format(",")(stats.populationChange)} higher than in ${stats.baselineYear}, reaching ${d3.format(",")(stats.population.total_population)}. ` +
    `Foreign-background residents represent ${stats.foreignShare.toFixed(1)}% of the total population, while the labour participation gap between Icelandic and foreign backgrounds is ${Math.abs(stats.labourGap).toFixed(1)} percentage points. ` +
    `${educationSentence} ${filterSentence}`;

  d3.select("#insight-summary-body").text(summary);
}

export function updateAllCharts() {
  updateTimelineSelector();
  updateFilterStatus();
  chartUpdaters.forEach((updateFn) => updateFn());
  updateInsights();
  updateMetricStrip();
  updateStoryPanel();
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

  d3.select("#data-quality-note").text(buildCoverageSummary());

  renderTimelineSelector();
  createPopulationChart(state.data.population);
  createCitizenshipChart(state.data.citizenship);
  createLabourChart(state.data.labour);
  createEducationChart(buildEducationRows());
  createPulseChart();

  d3.select("#year-slider")
    .attr("min", d3.min(state.years))
    .attr("max", d3.max(state.years))
    .property("value", state.selectedYear)
    .on("input", function () {
      setSelectedYear(toNumber(this.value, state.selectedYear), { revealTimelineLabel: true, force: true });
    });

  d3.select("#year-value").text(state.selectedYear);
  d3.select("#clear-filters").on("click", clearFilters);
  d3.select("#story-toggle").on("click", toggleStoryMode);
  d3.select("#area-mode-toggle").on("click", toggleAreaMode);

  updateAllCharts();
}

loadData().catch((error) => {
  console.error("Failed to initialize dashboard", error);
  d3.select("body")
    .append("p")
    .attr("class", "error-text")
    .text(`Failed to load one or more datasets. ${error.message}`);
});

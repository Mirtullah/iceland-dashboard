import {
  COLORS,
  TRANSITION_MS,
  formatSignedNumber,
  formatSignedPercent,
  getNearestRowForYear,
  hideTooltip,
  registerUpdater,
  showTooltip,
  state,
} from "./main.js";

const d3 = window.d3;

export function createPulseChart() {
  const width = 560;
  const height = 360;
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const radius = 116;
  const root = d3.select("#pulse-chart");
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const metrics = [
    { key: "growthSinceBaseline", label: "Growth", angle: -Math.PI / 2, color: COLORS.line, format: (d) => formatSignedNumber(d) },
    { key: "foreignShare", label: "Foreign Share", angle: 0, color: COLORS.foreign, format: (d) => `${d.toFixed(1)}%` },
    { key: "labourGap", label: "Labour Gap", angle: Math.PI / 2, color: "#7c3aed", format: (d) => formatSignedPercent(d) },
    { key: "tertiaryRate", label: "Tertiary Rate", angle: Math.PI, color: COLORS.tertiary, format: (d) => `${d.toFixed(1)}%` },
  ];

  const data = state.years.map((year) => {
    const baselineYear = d3.min(state.years);
    const population = getNearestRowForYear(state.data.population, year);
    const baselinePopulation = getNearestRowForYear(state.data.population, baselineYear);
    const citizenship = getNearestRowForYear(state.data.citizenship, year);
    const labour = getNearestRowForYear(state.data.labour, year);
    const education = getNearestRowForYear(state.data.education, year);
    const totalCitizenship = citizenship.icelandic + citizenship.foreign;

    return {
      year,
      growthSinceBaseline: population.total_population - baselinePopulation.total_population,
      foreignShare: totalCitizenship ? (citizenship.foreign / totalCitizenship) * 100 : 0,
      labourGap: Math.abs(labour.icelandic_share - labour.foreign_share),
      tertiaryRate: education ? education.tertiary_share_25_64_total : 0,
    };
  });

  const ranges = Object.fromEntries(metrics.map((metric) => [metric.key, d3.extent(data, (d) => d[metric.key])]));

  svg
    .append("g")
    .attr("class", "pulse-rings")
    .selectAll("circle")
    .data([0.25, 0.5, 0.75, 1])
    .join("circle")
    .attr("class", "pulse-ring")
    .attr("cx", centerX)
    .attr("cy", centerY)
    .attr("r", (d) => radius * d);

  svg.append("g").attr("class", "pulse-axes");
  svg.append("path").attr("class", "pulse-shape");
  svg.append("g").attr("class", "pulse-nodes");
  svg.append("g").attr("class", "pulse-labels");
  svg.append("circle").attr("class", "pulse-center").attr("cx", centerX).attr("cy", centerY).attr("r", 34);
  svg.append("text").attr("class", "pulse-center-year").attr("x", centerX).attr("y", centerY - 2).attr("text-anchor", "middle");
  svg.append("text").attr("class", "pulse-center-caption").attr("x", centerX).attr("y", centerY + 14).attr("text-anchor", "middle").text("Pulse");

  function updatePulseChart() {
    const selected = data.find((d) => d.year === state.selectedYear) || data[0];
    const points = metrics.map((metric) => {
      const [min, max] = ranges[metric.key];
      const scale = d3.scaleLinear().domain([min, max]).range([radius * 0.28, radius]);
      const valueRadius = scale(selected[metric.key]);

      return {
        ...metric,
        value: selected[metric.key],
        x: centerX + Math.cos(metric.angle) * valueRadius,
        y: centerY + Math.sin(metric.angle) * valueRadius,
        labelX: centerX + Math.cos(metric.angle) * (radius + 28),
        labelY: centerY + Math.sin(metric.angle) * (radius + 28),
        lineX: centerX + Math.cos(metric.angle) * radius,
        lineY: centerY + Math.sin(metric.angle) * radius,
      };
    });

    const radialLine = d3
      .line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveLinearClosed);

    svg
      .select(".pulse-axes")
      .selectAll("line")
      .data(points, (d) => d.key)
      .join("line")
      .attr("class", "pulse-axis")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x1", centerX)
      .attr("y1", centerY)
      .attr("x2", (d) => d.lineX)
      .attr("y2", (d) => d.lineY);

    svg
      .select(".pulse-shape")
      .datum(points)
      .transition()
      .duration(TRANSITION_MS)
      .attr("d", radialLine);

    svg
      .select(".pulse-nodes")
      .selectAll("circle")
      .data(points, (d) => d.key)
      .join("circle")
      .attr("class", "pulse-node")
      .on("mousemove", (event, d) => {
        showTooltip(event, `<strong>${d.label}</strong><br>${d.format(d.value)}`);
      })
      .on("mouseleave", hideTooltip)
      .transition()
      .duration(TRANSITION_MS)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 6.5)
      .attr("stroke", (d) => d.color);

    svg
      .select(".pulse-labels")
      .selectAll("text")
      .data(
        points.flatMap((d) => [
          { key: `${d.key}-label`, x: d.labelX, y: d.labelY - 6, text: d.label, className: "pulse-label" },
          { key: `${d.key}-value`, x: d.labelX, y: d.labelY + 10, text: d.format(d.value), className: "pulse-value-label" },
        ]),
        (d) => d.key
      )
      .join("text")
      .attr("class", (d) => d.className)
      .attr("text-anchor", (d) => (d.x < centerX - 20 ? "end" : d.x > centerX + 20 ? "start" : "middle"))
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .text((d) => d.text);

    svg.select(".pulse-center-year").text(selected.year);
  }

  registerUpdater(updatePulseChart);
  return { update: updatePulseChart };
}

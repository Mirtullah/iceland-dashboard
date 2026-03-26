import {
  CHART_HEIGHT,
  CHART_WIDTH,
  COLORS,
  LABELS,
  MARGIN,
  TRANSITION_MS,
  getRowForYear,
  getSelectionOpacity,
  hideTooltip,
  registerUpdater,
  setSelectedGroup,
  showTooltip,
  state,
} from "./main.js";

const d3 = window.d3;

export function createLabourChart(data) {
  const root = d3.select("#bar-chart");
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const groups = ["icelandic", "foreign"];
  const series = ["2016 baseline", "Selected year"];
  const x0 = d3.scaleBand().domain(groups).range([MARGIN.left, CHART_WIDTH - MARGIN.right]).padding(0.28);
  const x1 = d3.scaleBand().domain(series).range([0, x0.bandwidth()]).padding(0.14);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(-(CHART_WIDTH - MARGIN.left - MARGIN.right))
        .tickFormat("")
    );

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${CHART_HEIGHT - MARGIN.bottom})`)
    .call(d3.axisBottom(x0).tickFormat((d) => LABELS[d]));

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", (MARGIN.left + CHART_WIDTH - MARGIN.right) / 2)
    .attr("y", CHART_HEIGHT - 12)
    .attr("text-anchor", "middle")
    .text("Background group");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(CHART_HEIGHT / 2))
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Labour share (%)");

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top - 30})`);

  legend
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("transform", (_, i) => `translate(${i * 162},0)`)
    .each(function (d) {
      const g = d3.select(this);
      g.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 3)
        .attr("fill", d === "2016 baseline" ? "#bfdbfe" : "#1d4ed8");
      g.append("text").attr("x", 20).attr("y", 11).text(d);
    });

  svg.append("g").attr("class", "bars");
  svg.append("g").attr("class", "bar-labels");

  function updateLabourChart() {
    const baseline = getRowForYear(data, d3.min(state.years));
    const selected = getRowForYear(data, state.selectedYear);
    const barData = [
      { group: "icelandic", series: "2016 baseline", value: baseline.icelandic_share },
      { group: "icelandic", series: "Selected year", value: selected.icelandic_share },
      { group: "foreign", series: "2016 baseline", value: baseline.foreign_share },
      { group: "foreign", series: "Selected year", value: selected.foreign_share },
    ];

    svg
      .select(".bars")
      .selectAll("rect")
      .data(barData, (d) => `${d.group}-${d.series}`)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "labour-bar")
            .attr("x", (d) => x0(d.group) + x1(d.series))
            .attr("y", y(0))
            .attr("width", x1.bandwidth())
            .attr("height", 0)
            .style("cursor", "pointer")
            .on("click", (_, d) => setSelectedGroup(d.group))
            .on("mousemove", (event, d) => {
              showTooltip(event, `<strong>${LABELS[d.group]}</strong><br>${d.series}: ${d.value.toFixed(1)}%`);
            })
            .on("mouseleave", hideTooltip)
            .call((sel) =>
              sel
                .transition()
                .duration(TRANSITION_MS)
                .attr("y", (d) => y(d.value))
                .attr("height", (d) => y(0) - y(d.value))
            ),
        (update) => update,
        (exit) => exit.remove()
      )
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => x0(d.group) + x1(d.series))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => y(0) - y(d.value))
      .attr("fill", (d) => {
        if (d.series === "2016 baseline") {
          return d.group === "icelandic" ? "#bbf7d0" : "#fed7aa";
        }
        return COLORS[d.group];
      })
      .attr("opacity", (d) => getSelectionOpacity(d.group, null, 0.2))
      .attr("stroke", (d) => (state.selectedGroup === d.group ? COLORS.highlight : "none"))
      .attr("stroke-width", (d) => (state.selectedGroup === d.group ? 2.4 : 0));

    svg
      .select(".bar-labels")
      .selectAll("text")
      .data(barData, (d) => `${d.group}-${d.series}`)
      .join("text")
      .attr("class", "bar-label")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => x0(d.group) + x1(d.series) + x1.bandwidth() / 2)
      .attr("y", (d) => Math.max(MARGIN.top + 12, y(d.value) - 6))
      .attr("fill", "#0f172a")
      .style("font-weight", (d) => (state.selectedGroup === d.group ? 700 : 500))
      .style("opacity", (d) => getSelectionOpacity(d.group, null, 0.25))
      .text((d) => `${d.value.toFixed(1)}%`);
  }

  registerUpdater(updateLabourChart);
  return { update: updateLabourChart };
}

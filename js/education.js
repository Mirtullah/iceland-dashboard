import {
  CHART_WIDTH,
  COLORS,
  LABELS,
  MARGIN,
  TRANSITION_MS,
  getSelectionOpacity,
  hideTooltip,
  registerUpdater,
  showTooltip,
  state,
  toggleEducationSelection,
} from "./main.js";

const d3 = window.d3;

export function createEducationChart(data) {
  const educationHeight = 360;
  const educationBottomMargin = 92;
  const root = d3.select("#education-chart");
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_WIDTH} ${educationHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.levels.reduce((sum, level) => sum + level.value, 0))])
    .nice()
    .range([MARGIN.left, CHART_WIDTH - MARGIN.right]);
  const y = d3.scaleBand().domain(["icelandic", "foreign"]).range([MARGIN.top, educationHeight - educationBottomMargin]).padding(0.28);

  svg
    .append("g")
    .attr("class", "grid education-grid")
    .attr("transform", `translate(0,${educationHeight - educationBottomMargin})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickSize(-(educationHeight - MARGIN.top - educationBottomMargin))
        .tickFormat("")
    );

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${educationHeight - educationBottomMargin})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(",")));

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).tickFormat((d) => LABELS[d]));

  svg
    .append("text")
    .attr("class", "axis-label education-axis-label")
    .attr("x", (MARGIN.left + CHART_WIDTH - MARGIN.right) / 2)
    .attr("y", educationHeight - 44)
    .attr("text-anchor", "middle")
    .text("Estimated people in selected education category");

  svg
    .append("text")
    .attr("class", "education-subtitle")
    .attr("x", MARGIN.left)
    .attr("y", MARGIN.top - 30)
    .text("Structural estimate based on group population totals and the national tertiary share for ages 25-64.");

  svg.append("text").attr("class", "education-note").attr("x", MARGIN.left).attr("y", MARGIN.top - 12);

  const legend = svg
    .append("g")
    .attr("class", "legend education-legend")
    .attr("transform", `translate(${MARGIN.left},${educationHeight - 22})`);

  ["tertiary", "non_tertiary"].forEach((level, index) => {
    const item = legend.append("g").attr("transform", `translate(${index * 132},0)`);
    item.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", COLORS[level]);
    item.append("text").attr("class", "education-legend-text").attr("x", 20).attr("y", 11).text(LABELS[level]);
  });

  svg.append("g").attr("class", "education-bars");
  svg.append("g").attr("class", "education-labels");

  function updateEducationChart() {
    const yearRows = data.filter((d) => d.year === state.selectedYear);
    const barSegments = yearRows.flatMap((row) => {
      let running = 0;
      return row.levels.map((level) => {
        const segment = {
          year: row.year,
          educationYear: row.educationYear,
          group: row.group,
          level: level.level,
          value: level.value,
          start: running,
          end: running + level.value,
        };
        running += level.value;
        return segment;
      });
    });

    svg
      .select(".education-note")
      .text(() => {
        const referenceYear = yearRows[0]?.educationYear;
        if (referenceYear && referenceYear !== state.selectedYear) {
          return `Latest education rate available is ${referenceYear}, so ${state.selectedYear} uses that reference for the estimate.`;
        }
        return "Exact background-specific education counts are not available in the dataset, so this chart is presented as a structural comparison.";
      });

    svg
      .select(".education-bars")
      .selectAll("rect")
      .data(barSegments, (d) => `${d.group}-${d.level}`)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "education-segment")
            .attr("x", (d) => x(d.start))
            .attr("y", (d) => y(d.group))
            .attr("height", y.bandwidth())
            .attr("width", 0)
            .style("cursor", "pointer")
            .on("click", (_, d) => toggleEducationSelection(d.group, d.level))
            .on("mousemove", (event, d) => {
              const qualifier = d.educationYear !== d.year ? ` (rate from ${d.educationYear})` : "";
              showTooltip(
                event,
                `<strong>${LABELS[d.group]} - ${LABELS[d.level]}</strong><br>Estimated count: ${d3.format(",.0f")(d.value)}${qualifier}`
              );
            })
            .on("mouseleave", hideTooltip)
            .call((sel) =>
              sel
                .transition()
                .duration(TRANSITION_MS)
                .attr("width", (d) => x(d.end) - x(d.start))
            ),
        (update) => update,
        (exit) => exit.remove()
      )
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => x(d.start))
      .attr("y", (d) => y(d.group))
      .attr("height", y.bandwidth())
      .attr("width", (d) => x(d.end) - x(d.start))
      .attr("fill", (d) => COLORS[d.level])
      .attr("opacity", (d) => getSelectionOpacity(d.group, d.level, 0.16))
      .attr("stroke", (d) => {
        if (state.selectedGroup === d.group && state.selectedEducationLevel === d.level) {
          return COLORS.highlight;
        }
        if (state.selectedGroup === d.group) {
          return "#ffffff";
        }
        return "#f8fafc";
      })
      .attr("stroke-width", (d) => {
        if (state.selectedGroup === d.group && state.selectedEducationLevel === d.level) {
          return 2.6;
        }
        return 1.4;
      });

    svg
      .select(".education-labels")
      .selectAll("text")
      .data(barSegments.filter((d) => x(d.end) - x(d.start) > 62), (d) => `${d.group}-${d.level}`)
      .join("text")
      .attr("class", "education-label")
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => x(d.start) + 8)
      .attr("y", (d) => y(d.group) + y.bandwidth() / 2)
      .attr("fill", "#f8fafc")
      .style("font-weight", (d) => {
        if (state.selectedGroup === d.group && state.selectedEducationLevel === d.level) {
          return 700;
        }
        return 600;
      })
      .style("opacity", (d) => getSelectionOpacity(d.group, d.level, 0.18))
      .text((d) => `${LABELS[d.level]} ${d3.format(".0s")(d.value)}`);
  }

  registerUpdater(updateEducationChart);
  return { update: updateEducationChart };
}

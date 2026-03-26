import {
  CHART_HEIGHT,
  CHART_WIDTH,
  COLORS,
  LABELS,
  MARGIN,
  TRANSITION_MS,
  getRowForYear,
  hideTooltip,
  registerUpdater,
  setSelectedYear,
  showTooltip,
  state,
} from "./main.js";

const d3 = window.d3;

function buildLineAnnotations(data) {
  const highest = data.reduce((best, row) => (row.total_population > best.total_population ? row : best), data[0]);
  const changes = data.slice(1).map((row, index) => ({
    year: row.year,
    total_population: row.total_population,
    delta: row.total_population - data[index].total_population,
  }));
  const largestIncrease = changes.reduce((best, row) => (row.delta > best.delta ? row : best), changes[0]);

  return [
    {
      key: "baseline",
      year: data[0].year,
      total_population: data[0].total_population,
      label: `Start of series (${data[0].year})`,
      direction: "right",
      offsetX: 14,
      offsetY: -18,
    },
    {
      key: "highest",
      year: highest.year,
      total_population: highest.total_population,
      label: `Highest population: ${highest.year}`,
      direction: "left",
      offsetX: -16,
      offsetY: -26,
    },
    {
      key: "largest-growth",
      year: largestIncrease.year,
      total_population: largestIncrease.total_population,
      label: `Largest annual increase: +${d3.format(",")(largestIncrease.delta)}`,
      direction: "right",
      offsetX: 16,
      offsetY: 24,
    },
  ];
}

export function createPopulationChart(data) {
  const root = d3.select("#line-chart");
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([MARGIN.left, CHART_WIDTH - MARGIN.right]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.total_population)])
    .nice()
    .range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);

  const lineGenerator = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.total_population));

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(6)
        .tickSize(-(CHART_WIDTH - MARGIN.left - MARGIN.right))
        .tickFormat("")
    );

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${CHART_HEIGHT - MARGIN.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",")));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", (MARGIN.left + CHART_WIDTH - MARGIN.right) / 2)
    .attr("y", CHART_HEIGHT - 12)
    .attr("text-anchor", "middle")
    .text("Year");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(CHART_HEIGHT / 2))
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Total population");

  svg
    .append("path")
    .datum(data)
    .attr("class", "line-path")
    .attr("fill", "none")
    .attr("stroke", COLORS.line)
    .attr("stroke-width", 2.8)
    .attr("d", lineGenerator);

  svg.append("g").attr("class", "line-points");
  svg.append("g").attr("class", "line-annotations");

  svg
    .append("line")
    .attr("class", "selected-year-line")
    .attr("y1", MARGIN.top)
    .attr("y2", CHART_HEIGHT - MARGIN.bottom);

  svg.append("circle").attr("class", "selected-year-dot").attr("r", 6.5);

  svg
    .append("text")
    .attr("class", "line-filter-note")
    .attr("x", CHART_WIDTH - MARGIN.right)
    .attr("y", MARGIN.top - 28)
    .attr("text-anchor", "end");

  const xPositions = data.map((d) => x(d.year));
  const hoverBands = data.map((d, i) => ({
    ...d,
    x0: i === 0 ? MARGIN.left : (xPositions[i - 1] + xPositions[i]) / 2,
    x1: i === data.length - 1 ? CHART_WIDTH - MARGIN.right : (xPositions[i] + xPositions[i + 1]) / 2,
  }));

  svg
    .append("g")
    .attr("class", "line-hover-bands")
    .selectAll("rect")
    .data(hoverBands)
    .join("rect")
    .attr("class", "year-hover-band")
    .attr("x", (d) => d.x0)
    .attr("y", MARGIN.top)
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", CHART_HEIGHT - MARGIN.top - MARGIN.bottom)
    .attr("fill", "transparent")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `Select year ${d.year}`)
    .on("mouseenter", (event, d) => {
      setSelectedYear(d.year);
      showTooltip(event, `<strong>${d.year}</strong><br>Population: ${d3.format(",")(d.total_population)}`);
    })
    .on("mousemove", (event, d) => {
      setSelectedYear(d.year);
      showTooltip(event, `<strong>${d.year}</strong><br>Population: ${d3.format(",")(d.total_population)}`);
    })
    .on("mouseleave", hideTooltip)
    .on("click", (_, d) => setSelectedYear(d.year))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedYear(d.year);
      }
    });

  const annotations = buildLineAnnotations(data);

  function updatePopulationChart() {
    const selectedRow = getRowForYear(data, state.selectedYear);
    const lineColor = state.selectedGroup ? COLORS[state.selectedGroup] : COLORS.line;

    svg
      .select(".line-path")
      .transition()
      .duration(TRANSITION_MS)
      .attr("stroke", lineColor)
      .attr("stroke-width", state.selectedGroup ? 3.4 : 2.8)
      .attr("opacity", state.selectedEducationLevel ? 0.8 : 1);

    svg
      .select(".line-points")
      .selectAll("circle")
      .data(data, (d) => d.year)
      .join("circle")
      .attr("class", "line-point")
      .on("mousemove", (event, d) => {
        showTooltip(event, `<strong>${d.year}</strong><br>Population: ${d3.format(",")(d.total_population)}`);
      })
      .on("mouseleave", hideTooltip)
      .transition()
      .duration(TRANSITION_MS)
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.total_population))
      .attr("r", (d) => (d.year === selectedRow.year ? 6.5 : 4.5))
      .attr("fill", (d) => (d.year === selectedRow.year ? COLORS.selection : lineColor))
      .attr("stroke", (d) => (d.year === selectedRow.year ? "#7f1d1d" : "#ffffff"))
      .attr("stroke-width", (d) => (d.year === selectedRow.year ? 2.4 : 1.3))
      .attr("opacity", (d) => (d.year === selectedRow.year ? 1 : 0.88));

    svg
      .select(".selected-year-line")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x1", x(selectedRow.year))
      .attr("x2", x(selectedRow.year))
      .attr("stroke", COLORS.highlight)
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "4 4")
      .attr("opacity", 0.8);

    svg
      .select(".selected-year-dot")
      .transition()
      .duration(TRANSITION_MS)
      .attr("cx", x(selectedRow.year))
      .attr("cy", y(selectedRow.total_population))
      .attr("fill", COLORS.selection)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.5);

    const annotationJoin = svg
      .select(".line-annotations")
      .selectAll("g.annotation")
      .data(annotations, (d) => d.key)
      .join((enter) => {
        const g = enter.append("g").attr("class", "annotation");
        g.append("line").attr("class", "annotation-connector");
        g.append("circle").attr("class", "annotation-marker");
        g.append("rect").attr("class", "annotation-label-bg").attr("rx", 6);
        g.append("text").attr("class", "annotation-label");
        return g;
      });

    annotationJoin.each(function (d) {
      const group = d3.select(this);
      const x1 = x(d.year);
      const y1 = y(d.total_population);
      const x2 = x1 + d.offsetX;
      const y2 = y1 + d.offsetY;

      group
        .select(".annotation-connector")
        .transition()
        .duration(TRANSITION_MS)
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("opacity", 0.9);

      group
        .select(".annotation-marker")
        .transition()
        .duration(TRANSITION_MS)
        .attr("cx", x1)
        .attr("cy", y1)
        .attr("r", d.key === "highest" ? 6.2 : 5.2)
        .attr("fill", d.key === "highest" ? COLORS.selection : "#ffffff")
        .attr("stroke", d.key === "highest" ? "#7f1d1d" : lineColor)
        .attr("stroke-width", 2.3);

      group
        .select(".annotation-label")
        .text(d.label)
        .attr("x", x2)
        .attr("y", y2)
        .attr("text-anchor", d.direction === "left" ? "end" : "start")
        .attr("dominant-baseline", "middle");

      const bbox = group.select(".annotation-label").node().getBBox();
      const padding = 6;

      group
        .select(".annotation-label-bg")
        .transition()
        .duration(TRANSITION_MS)
        .attr("x", bbox.x - padding)
        .attr("y", bbox.y - 4)
        .attr("width", bbox.width + padding * 2)
        .attr("height", bbox.height + 8)
        .attr("opacity", 1);
    });

    const filterNote = [state.selectedGroup ? LABELS[state.selectedGroup] : null, state.selectedEducationLevel ? LABELS[state.selectedEducationLevel] : null]
      .filter(Boolean)
      .join(" + ");

    svg.select(".line-filter-note").text(filterNote ? `Linked highlight: ${filterNote}` : "");
  }

  registerUpdater(updatePopulationChart);
  return { update: updatePopulationChart };
}

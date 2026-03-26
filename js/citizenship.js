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
// citizenship chart - Kumaresan contribution
const d3 = window.d3;

export function createCitizenshipChart(data) {
  const root = d3.select("#area-chart");
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const groups = ["icelandic", "foreign"];
  const stack = d3.stack().keys(groups);
  const series = stack(data);
  const latestYear = d3.max(data, (d) => d.year);
  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([MARGIN.left, CHART_WIDTH - MARGIN.right]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.icelandic + d.foreign)])
    .nice()
    .range([CHART_HEIGHT - MARGIN.bottom, MARGIN.top]);

  const area = d3
    .area()
    .x((d) => x(d.data.year))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveMonotoneX);

  const line = d3
    .line()
    .x((d) => x(d.data.year))
    .y((d) => y(d[1]))
    .curve(d3.curveMonotoneX);

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
    .call(d3.axisBottom(x).ticks(data.length).tickFormat(d3.format("d")));

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
    .text("Population");

  svg.append("g").attr("class", "area-series");
  svg.append("g").attr("class", "area-boundaries");
  svg.append("g").attr("class", "area-end-labels");
  svg.append("rect").attr("class", "area-selected-band");
  svg.append("line").attr("class", "area-selected-line");
  svg.append("g").attr("class", "area-selected-dots");
  svg.append("line").attr("class", "area-hover-line");
  svg.append("g").attr("class", "area-hover-dots");

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top - 30})`);

  legend
    .selectAll("g")
    .data(groups)
    .join("g")
    .attr("transform", (_, i) => `translate(${i * 188},0)`)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `Highlight ${LABELS[d]}`)
    .style("cursor", "pointer")
    .on("click", (_, d) => setSelectedGroup(d))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedGroup(d);
      }
    })
    .each(function (d) {
      const g = d3.select(this);
      g.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", COLORS[d]);
      g.append("text").attr("x", 20).attr("y", 11).text(LABELS[d]);
    });

  let hoveredYear = null;

  svg
    .append("g")
    .attr("class", "area-hover-bands")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "year-hover-band")
    .attr("x", (d, i) => {
      const current = x(d.year);
      return i === 0 ? MARGIN.left : (x(data[i - 1].year) + current) / 2;
    })
    .attr("y", MARGIN.top)
    .attr("width", (d, i) => {
      const current = x(d.year);
      const next = i === data.length - 1 ? CHART_WIDTH - MARGIN.right : (current + x(data[i + 1].year)) / 2;
      const prev = i === 0 ? MARGIN.left : (x(data[i - 1].year) + current) / 2;
      return Math.max(0, next - prev);
    })
    .attr("height", CHART_HEIGHT - MARGIN.top - MARGIN.bottom)
    .attr("fill", "transparent")
    .on("mousemove", (event, d) => {
      hoveredYear = d.year;
      updateCitizenshipChart();
      showTooltip(
        event,
        `<strong>${d.year}</strong><br>${LABELS.icelandic}: ${d3.format(",")(d.icelandic)}<br>${LABELS.foreign}: ${d3.format(",")(d.foreign)}`
      );
    })
    .on("mouseleave", () => {
      hoveredYear = null;
      hideTooltip();
      updateCitizenshipChart();
    });

  function updateCitizenshipChart() {
    const activeGroup = state.selectedGroup ? LABELS[state.selectedGroup] : "All backgrounds";
    const selectedRow = getRowForYear(data, state.selectedYear);
    const hoverRow = hoveredYear !== null ? getRowForYear(data, hoveredYear) : null;
    const endRows = groups.map((group) => {
      const layer = series.find((item) => item.key === group);
      const latestPoint = layer.find((d) => d.data.year === latestYear);
      return {
        group,
        x: x(latestYear),
        y: y(latestPoint[1]),
      };
    });

    const hoverRows = hoverRow
      ? groups.map((group) => {
          const layer = series.find((item) => item.key === group);
          const point = layer.find((d) => d.data.year === hoverRow.year);
          return {
            group,
            x: x(hoverRow.year),
            y: y(point[1]),
          };
        })
      : [];

    const selectedRows = groups.map((group) => {
      const layer = series.find((item) => item.key === group);
      const point = layer.find((d) => d.data.year === selectedRow.year);
      return {
        group,
        x: x(selectedRow.year),
        y: y(point[1]),
      };
    });

    svg
      .select(".area-series")
      .selectAll("path")
      .data(series, (d) => d.key)
      .join("path")
      .attr("class", (d) => `area-layer area-${d.key}`)
      .style("cursor", "pointer")
      .on("click", (_, d) => setSelectedGroup(d.key))
      .on("mousemove", (event, d) => {
        showTooltip(
          event,
          `<strong>${LABELS[d.key]}</strong><br>${selectedRow.year}: ${d3.format(",")(selectedRow[d.key])}`
        );
      })
      .on("mouseleave", hideTooltip)
      .transition()
      .duration(TRANSITION_MS)
      .attr("d", area)
      .attr("fill", (d) => COLORS[d.key])
      .attr("fill-opacity", (d) => (state.selectedGroup && state.selectedGroup !== d.key ? 0.16 : 0.42))
      .attr("opacity", (d) => getSelectionOpacity(d.key, null, 0.25));

    svg
      .select(".area-boundaries")
      .selectAll("path")
      .data(series, (d) => d.key)
      .join("path")
      .attr("class", (d) => `area-boundary area-boundary-${d.key}`)
      .style("pointer-events", "none")
      .transition()
      .duration(TRANSITION_MS)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", (d) => (state.selectedGroup === d.key ? COLORS.highlight : COLORS[d.key]))
      .attr("stroke-width", (d) => (state.selectedGroup === d.key ? 3 : 2.2))
      .attr("opacity", (d) => getSelectionOpacity(d.key, null, 0.34));

    svg
      .select(".area-selected-band")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", Math.max(MARGIN.left, x(selectedRow.year) - 16))
      .attr("y", MARGIN.top)
      .attr("width", 32)
      .attr("height", CHART_HEIGHT - MARGIN.top - MARGIN.bottom)
      .attr("fill", "#dbeafe")
      .attr("opacity", 0.3);

    svg
      .select(".area-selected-line")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x1", x(selectedRow.year))
      .attr("x2", x(selectedRow.year))
      .attr("y1", MARGIN.top)
      .attr("y2", CHART_HEIGHT - MARGIN.bottom)
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 1.4)
      .attr("opacity", 0.85);

    svg
      .select(".area-selected-dots")
      .selectAll("circle")
      .data(selectedRows, (d) => d.group)
      .join("circle")
      .attr("class", "area-selected-dot")
      .style("pointer-events", "none")
      .transition()
      .duration(TRANSITION_MS)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => (state.selectedGroup === d.group ? 6.5 : 5.5))
      .attr("fill", "#ffffff")
      .attr("stroke", (d) => (state.selectedGroup === d.group ? COLORS.highlight : COLORS[d.group]))
      .attr("stroke-width", (d) => (state.selectedGroup === d.group ? 2.8 : 2.2))
      .attr("opacity", (d) => getSelectionOpacity(d.group, null, 0.24));

    svg
      .select(".area-hover-line")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x1", hoverRow ? x(hoverRow.year) : x(selectedRow.year))
      .attr("x2", hoverRow ? x(hoverRow.year) : x(selectedRow.year))
      .attr("y1", MARGIN.top)
      .attr("y2", CHART_HEIGHT - MARGIN.bottom)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.1)
      .attr("opacity", hoverRow ? 0.7 : 0);

    svg
      .select(".area-hover-dots")
      .selectAll("circle")
      .data(hoverRows, (d) => d.group)
      .join("circle")
      .attr("class", "area-hover-dot")
      .style("pointer-events", "none")
      .transition()
      .duration(160)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => (state.selectedGroup === d.group ? 6 : 5))
      .attr("fill", "#ffffff")
      .attr("stroke", (d) => (state.selectedGroup === d.group ? COLORS.highlight : COLORS[d.group]))
      .attr("stroke-width", (d) => (state.selectedGroup === d.group ? 2.6 : 2.1))
      .attr("opacity", (d) => getSelectionOpacity(d.group, null, 0.18));

    svg
      .select(".area-end-labels")
      .selectAll("text")
      .data(endRows, (d) => d.group)
      .join("text")
      .attr("class", "area-end-label")
      .style("pointer-events", "none")
      .transition()
      .duration(TRANSITION_MS)
      .attr("x", (d) => Math.min(CHART_WIDTH - MARGIN.right + 4, d.x + 8))
      .attr("y", (d, i) => d.y + (i === 0 ? -8 : 10))
      .attr("fill", (d) => (state.selectedGroup === d.group ? COLORS.highlight : COLORS[d.group]))
      .style("font-weight", (d) => (state.selectedGroup === d.group ? 700 : 600))
      .style("opacity", (d) => getSelectionOpacity(d.group, null, 0.25))
      .text((d) => LABELS[d.group]);

    svg
      .selectAll(".legend g")
      .transition()
      .duration(TRANSITION_MS)
      .attr("opacity", (d) => getSelectionOpacity(d, null, 0.25))
      .attr("transform", (d, i) => `translate(${i * 188},0) scale(${state.selectedGroup === d ? 1.03 : 1})`);

    svg
      .selectAll(".legend g rect")
      .transition()
      .duration(TRANSITION_MS)
      .attr("stroke", (d) => (state.selectedGroup === d ? COLORS.highlight : "none"))
      .attr("stroke-width", (d) => (state.selectedGroup === d ? 2 : 0));

    svg
      .selectAll(".legend g text")
      .transition()
      .duration(TRANSITION_MS)
      .style("font-weight", (d) => (state.selectedGroup === d ? 700 : 500));

    d3.select("#citizenship-filter-badge")
      .classed("is-active", Boolean(state.selectedGroup))
      .text(`Year: ${selectedRow.year} | Filter: ${activeGroup}`);
  }

  registerUpdater(updateCitizenshipChart);
  return { update: updateCitizenshipChart };
}

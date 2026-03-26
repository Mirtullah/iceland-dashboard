# Population Change in Iceland (2016-2025) - F21DV Dashboard

## Project Overview
This single-page D3.js dashboard tells a linked story about population change in Iceland from 2016 to 2025. It connects four views:

- total population trend
- citizenship composition
- labour participation by background
- education structure by background

The project uses only HTML, CSS, JavaScript, and D3.js v7.

## File Structure
- `index.html` - page layout, chart containers, controls, and narrative sections
- `script.js` - data loading, state management, chart rendering, and linked interactions
- `style.css` - dashboard styling, annotation styling, and responsive layout
- `data/population_year.csv` - yearly total population
- `data/citizenship_year.csv` - yearly Icelandic-background and foreign-background population totals
- `data/labour_share_year.csv` - yearly labour share percentages by background
- `data/education_year.csv` - yearly national tertiary education share for ages 25-64

## Charts
### 1. Total Population Trend
- Interactive line chart for 2016-2025 total population
- Selected year is highlighted with a vertical guide and marker
- Annotation callouts identify:
  - the start of the series
  - the highest population year
  - the largest year-on-year increase

### 2. Citizenship Composition
- Refined stacked area chart of Icelandic-background and foreign-background population totals by year
- Lighter fills, stronger boundary lines, and end-of-series labels make the two groups easier to distinguish without clutter
- Clicking an area band or legend item applies a persistent group filter
- Selected and non-selected states are reflected across the whole dashboard

### 3. Labour Participation by Background
- Grouped bar chart comparing the selected year with the 2016 baseline
- Clicking a bar highlights the same background group across all other charts

### 4. Education Structure by Background
- The original treemap was replaced with a stacked bar chart
- This is easier to read and more defensible for coursework discussion
- The chart explicitly states that background-specific education counts are not available in the dataset
- Instead, it shows a structural estimate derived from:
  - background population totals
  - the national tertiary-share indicator for ages 25-64

## Interaction Design
- Year selection uses a custom clickable timeline
- Hover tooltips are preserved across the charts
- Linked highlighting is bidirectional:
  - area chart -> labour and education
  - labour chart -> area and education
  - education chart -> area and labour
  - all selections are also reflected visually in the line chart
- A visible `Current filter` status summarises the active state
- A `Clear filters` button resets group and education selections
- Non-selected categories dim more strongly to improve clarity

## New Coursework Improvements
### Annotation-Based Storytelling
- The line chart now includes annotation callouts for key moments in the series
- These callouts combine markers, labels, and connector lines to make the narrative more explicit

### Bidirectional Filter Feedback
- The dashboard now provides clearer persistent feedback when a user selects a background or education category
- The active filter is shown near the controls, and all linked charts use the same emphasis and dimming logic

### Education Chart Improvement
- The education treemap was replaced with a stacked bar chart because the available dataset does not contain exact background-specific education counts
- The revised chart makes the limitation explicit and presents the comparison as a structural estimate instead of implying precise composition data

## How to Run
1. Open a terminal in the project folder.
2. Start a local server, for example:
   `python -m http.server 8000`
3. Open `http://localhost:8000` in a browser.

Using `file://` directly may block CSV loading in some browsers, so a local server is recommended.

import * as d3 from "d3";
import {
	appendDataTable,
	appendFigureDescription,
	bindTooltipInteractions,
} from "../helpers/a11y";
import { styleAxis } from "../helpers/axis";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
} from "../helpers/chartFrame";
import { formatCount } from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { YearSiteDatum } from "../types";

interface LaunchTimelineData {
	sites: string[];
	data: YearSiteDatum[];
}

const SITE_PALETTE = [
	"#56B4E9",
	"#E69F00",
	"#009E73",
	"#D55E00",
	"#CC79A7",
	"#F0E442",
];

interface YearAggregate {
	year: number;
	total: number;
	bySite: Record<string, number>;
}

export function renderLaunchTimeline(
	container: HTMLElement,
	timeline: LaunchTimelineData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = { ...chartMargins.timeline, right: 250, bottom: 92 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const years = [...new Set(timeline.data.map((item) => item.year))].sort(
		(left, right) => left - right,
	);
	const axisYears = years.filter((year) => year >= 2000);
	const maxTickCount = Math.max(6, Math.floor(innerWidth / 48));
	const tickStep = Math.max(1, Math.ceil(axisYears.length / maxTickCount));
	const xTicks = axisYears.filter(
		(year, index) => index % tickStep === 0 || year === axisYears.at(-1),
	);
	if (
		xTicks.length >= 2 &&
		xTicks[xTicks.length - 1] - xTicks[xTicks.length - 2] < tickStep
	) {
		xTicks.splice(xTicks.length - 2, 1);
	}
	const siteLabels = new Map(
		timeline.data.map((item) => [item.site, item.label]),
	);
	const stackedRows = years.map((year) => {
		const row = { year } as Record<string, number>;
		for (const site of timeline.sites) {
			row[site] =
				timeline.data.find((item) => item.year === year && item.site === site)
					?.count ?? 0;
		}
		return row;
	});
	const stack = d3.stack<Record<string, number>>().keys(timeline.sites);
	const series = stack(stackedRows);
	const x = d3
		.scaleBand<number>()
		.domain(years)
		.range([0, innerWidth])
		.padding(0.16);
	const y = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(stackedRows, (row) =>
				d3.sum(timeline.sites, (site) => row[site] ?? 0),
			) ?? 0,
		])
		.nice()
		.range([innerHeight, 0]);
	const color = d3
		.scaleOrdinal<string, string>()
		.domain(timeline.sites)
		.range(SITE_PALETTE);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`);

	const aggregates: YearAggregate[] = stackedRows.map((row) => {
		const bySite: Record<string, number> = {};
		let total = 0;
		for (const site of timeline.sites) {
			const value = row[site] ?? 0;
			bySite[site] = value;
			total += value;
		}
		return { year: row.year, total, bySite };
	});
	const totalsBySite = new Map<string, number>();
	for (const site of timeline.sites) {
		totalsBySite.set(
			site,
			aggregates.reduce((sum, year) => sum + (year.bySite[site] ?? 0), 0),
		);
	}
	const overallTotal =
		[...totalsBySite.values()].reduce((sum, value) => sum + value, 0) || 1;
	const dominantSite = [...totalsBySite.entries()].sort(
		(left, right) => right[1] - left[1],
	)[0];
	const peakYear = aggregates.reduce<YearAggregate | null>((acc, item) => {
		if (!acc || item.total > acc.total) return item;
		return acc;
	}, null);
	const description =
		dominantSite && peakYear
			? `Entre ${years[0]} et ${years.at(-1)}, ${formatCount(overallTotal)} satellites ont été lancés depuis ${timeline.sites.length} sites. Le pic annuel est atteint en ${peakYear.year} avec ${formatCount(peakYear.total)} satellites. Site dominant : ${siteLabels.get(dominantSite[0]) ?? dominantSite[0]} avec ${formatCount(dominantSite[1])} satellites (${Math.round((dominantSite[1] / overallTotal) * 100)} %).`
			: "Évolution annuelle des lancements par site.";

	appendFigureDescription({
		svg,
		title: "Lancements annuels empilés par site de lancement",
		description,
	});

	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	const xAxis = root
		.append("g")
		.attr("aria-hidden", "true")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.tickValues(xTicks)
				.tickFormat((value) => d3.format("d")(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	xAxis
		.selectAll<SVGTextElement, number>("text")
		.attr("text-anchor", "end")
		.attr("transform", "translate(-8, 10) rotate(-35)");

	root
		.append("g")
		.attr("aria-hidden", "true")
		.call(d3.axisLeft(y).ticks(5))
		.call((axis) => styleAxis(axis));

	interface StackedSegment {
		key: string;
		year: number;
		count: number;
		y0: number;
		y1: number;
	}

	const showSegmentTooltip = (
		event: PointerEvent | MouseEvent,
		item: StackedSegment,
	) => {
		highlightSite(item.key);
		tooltip.show(
			buildTooltip({
				title: siteLabels.get(item.key) ?? item.key,
				subtitle: `${item.year}`,
				rows: [{ label: "Satellites", value: formatCount(item.count) }],
			}),
			event,
		);
	};

	const bars = root
		.selectAll(".launch-series")
		.data(series)
		.join("g")
		.attr("class", "launch-series")
		.attr("fill", (item) => color(item.key))
		.selectAll<SVGRectElement, StackedSegment>("rect")
		.data((item) =>
			item.map<StackedSegment>((segment) => ({
				key: item.key,
				year: segment.data.year,
				count: segment.data[item.key] ?? 0,
				y0: segment[0],
				y1: segment[1],
			})),
		)
		.join("rect")
		.attr("x", (item) => x(item.year) ?? 0)
		.attr("y", (item) => y(item.y1))
		.attr("width", x.bandwidth())
		.attr("height", (item) => Math.max(0, y(item.y0) - y(item.y1)))
		.attr("stroke", stagePalette.background)
		.attr("stroke-width", (item) => (item.count > 0 ? 1 : 0))
		.attr("tabindex", (item) => (item.count > 0 ? 0 : null))
		.attr("role", (item) => (item.count > 0 ? "button" : null))
		.attr("aria-describedby", tooltip.id)
		.attr("aria-label", (item) =>
			item.count > 0
				? `${siteLabels.get(item.key) ?? item.key}, ${item.year} : ${formatCount(item.count)} satellites`
				: null,
		)
		.style("cursor", (item) => (item.count > 0 ? "pointer" : "default"));

	bindTooltipInteractions(
		bars.filter((item) => item.count > 0),
		{
			show: (event, item) => showSegmentTooltip(event, item),
			move: (event) => tooltip.move(event),
			hide: () => {
				highlightSite(null);
				tooltip.hide();
			},
		},
	);

	function highlightSite(site: string | null) {
		bars
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!site || item.key === site
					? chartInteraction.idle
					: chartInteraction.muted,
			);
	}

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 210}, ${chartFrame.contentTop - 14})`,
		);

	appendLegend(legend, {
		x: 0,
		y: 0,
		title: "Sites et rythme",
		items: [
			...timeline.sites.map((site) => ({
				label: siteLabels.get(site) ?? site,
				color: color(site),
				marker: { type: "rect" as const },
				onPointerEnter: () => highlightSite(site),
				onPointerLeave: () => highlightSite(null),
			})),
		],
	});

	appendChartHeader(
		svg,
		"Une accélération récente, tirée par quelques bases",
		"Les barres suivent les sites dominants et isolent la concentration récente des volumes.",
	);

	appendDataTable({
		container,
		caption: "Lancements annuels par site de lancement",
		summary: description,
		columns: [
			{ header: "Année", accessor: (row: YearAggregate) => row.year },
			...timeline.sites.map((site) => ({
				header: siteLabels.get(site) ?? site,
				accessor: (row: YearAggregate) => formatCount(row.bySite[site] ?? 0),
			})),
			{
				header: "Total",
				accessor: (row: YearAggregate) => formatCount(row.total),
			},
		],
		rows: aggregates,
	});
}

import * as d3 from "d3";
import { appendDataTable, appendFigureDescription } from "../helpers/a11y";
import { styleAxis } from "../helpers/axis";
import {
	appendAxisLabel,
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
	chartTypography,
} from "../helpers/chartFrame";
import { formatCount, formatKm } from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import { colorFromMap, orbitPalette, stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { OrbitScatterDatum } from "../types";

const symbolByClass = new Map<string, d3.SymbolType>([
	["LEO", d3.symbolCircle],
	["MEO", d3.symbolSquare],
	["GEO", d3.symbolTriangle],
	["Elliptical", d3.symbolDiamond],
	["Non précisée", d3.symbolCross],
]);

const SYMBOL_AREA = 26;
const HIT_RADIUS = 18;

function symbolForClass(orbitClass: string) {
	return symbolByClass.get(orbitClass) ?? d3.symbolCircle;
}

function symbolNameForClass(orbitClass: string) {
	const symbol = symbolByClass.get(orbitClass);
	if (symbol === d3.symbolSquare) return "carré";
	if (symbol === d3.symbolTriangle) return "triangle";
	if (symbol === d3.symbolDiamond) return "losange";
	if (symbol === d3.symbolCross) return "croix";
	return "cercle";
}

interface OrbitClassSummary {
	orbitClass: string;
	count: number;
	share: number;
	medianPerigee: number;
	medianApogee: number;
}

interface ProjectedOrbitDatum extends OrbitScatterDatum {
	x: number;
	y: number;
}

export function renderOrbitScatter(
	container: HTMLElement,
	data: OrbitScatterDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.scatter;
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3.scaleLog().domain([100, 400000]).range([0, innerWidth]);
	const y = d3.scaleLog().domain([100, 400000]).range([innerHeight, 0]);
	const classes = [...new Set(data.map((item) => item.classOrbit))];
	const symbol = d3.symbol().size(SYMBOL_AREA);
	const projectedData: ProjectedOrbitDatum[] = data.map((item) => ({
		...item,
		x: x(item.perigee),
		y: y(item.apogee),
	}));
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`);

	const summaries: OrbitClassSummary[] = classes
		.map((orbitClass) => {
			const subset = data.filter((item) => item.classOrbit === orbitClass);
			return {
				orbitClass,
				count: subset.length,
				share: subset.length / Math.max(1, data.length),
				medianPerigee: d3.median(subset, (item) => item.perigee) ?? 0,
				medianApogee: d3.median(subset, (item) => item.apogee) ?? 0,
			};
		})
		.sort((left, right) => right.count - left.count);
	const dominant = summaries[0];
	const description = dominant
		? `${formatCount(data.length)} satellites positionnés selon leur périgée et apogée. ${dominant.orbitClass} domine avec ${formatCount(dominant.count)} satellites (${Math.round(dominant.share * 100)} %), périgée médian ${formatKm(Math.round(dominant.medianPerigee))} et apogée médian ${formatKm(Math.round(dominant.medianApogee))}. Chaque classe d'orbite est codée par une couleur et une forme différentes (${classes.map((c) => `${c} : ${symbolNameForClass(c)}`).join(", ")}).`
		: "Nuage de points sur les altitudes d'orbite.";

	appendFigureDescription({
		svg,
		title: "Altitudes d'orbite : périgée vs apogée",
		description,
	});

	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);
	const tickValues = [100, 300, 1000, 3000, 10000, 36000, 100000];

	root
		.append("g")
		.attr("aria-hidden", "true")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.tickValues(tickValues)
				.tickFormat((value) => formatKm(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	root
		.append("g")
		.attr("aria-hidden", "true")
		.call(
			d3
				.axisLeft(y)
				.tickValues(tickValues)
				.tickFormat((value) => formatKm(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	root
		.append("line")
		.attr("aria-hidden", "true")
		.attr("x1", x(100))
		.attr("y1", y(100))
		.attr("x2", x(400000))
		.attr("y2", y(400000))
		.attr("stroke", "rgba(255,255,255,0.45)")
		.attr("stroke-dasharray", "8 6");

	root
		.append("text")
		.attr("aria-hidden", "true")
		.attr("x", x(360000))
		.attr("y", y(360000))
		.attr("dy", "-0.7em")
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.annotation)
		.text("apogée = périgée");

	const imageCache = new Map<string, string>();
	const symbolPaths = new Map<string, Path2D>();
	const getSymbolPath = (orbitClass: string) => {
		const cached = symbolPaths.get(orbitClass);
		if (cached) {
			return cached;
		}
		const pathData = symbol.type(symbolForClass(orbitClass))() ?? "";
		const path = new Path2D(pathData);
		symbolPaths.set(orbitClass, path);
		return path;
	};

	const getScatterImage = (orbitClass: string | null) => {
		const cacheKey = orbitClass ?? "__all";
		const cached = imageCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const pixelRatio = window.devicePixelRatio || 1;
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(innerWidth * pixelRatio);
		canvas.height = Math.ceil(innerHeight * pixelRatio);

		const context = canvas.getContext("2d");
		if (!context) {
			return "";
		}

		context.scale(pixelRatio, pixelRatio);
		context.strokeStyle = stagePalette.background;
		context.lineWidth = 0.5;

		for (const item of projectedData) {
			const isActive = !orbitClass || item.classOrbit === orbitClass;
			context.globalAlpha = isActive
				? orbitClass
					? chartInteraction.idle
					: 0.85
				: chartInteraction.faint;
			context.fillStyle = colorFromMap(orbitPalette, item.classOrbit);
			context.save();
			context.translate(item.x, item.y);
			const path = getSymbolPath(item.classOrbit);
			context.fill(path);
			context.stroke(path);
			context.restore();
		}

		const image = canvas.toDataURL("image/png");
		imageCache.set(cacheKey, image);
		return image;
	};

	const pointsImage = root
		.append("image")
		.attr("aria-hidden", "true")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", innerWidth)
		.attr("height", innerHeight)
		.attr("href", getScatterImage(null));

	const delaunay = d3.Delaunay.from(
		projectedData,
		(item) => item.x,
		(item) => item.y,
	);
	let activePointIndex: number | null = null;

	const hidePointTooltip = () => {
		activePointIndex = null;
		tooltip.hide();
	};

	const showPointTooltip = (event: PointerEvent) => {
		const rootNode = root.node();
		if (!rootNode || projectedData.length === 0) {
			hidePointTooltip();
			return;
		}

		const [pointerX, pointerY] = d3.pointer(event, rootNode);
		const nearestIndex = delaunay.find(pointerX, pointerY);
		const item = projectedData[nearestIndex];
		const distance = Math.hypot(pointerX - item.x, pointerY - item.y);

		if (distance > HIT_RADIUS) {
			hidePointTooltip();
			return;
		}

		if (activePointIndex === nearestIndex) {
			tooltip.move(event);
			return;
		}

		activePointIndex = nearestIndex;
		tooltip.show(
			buildTooltip({
				title: item.name,
				subtitle: `${item.classOrbit} / ${item.typeOrbit}`,
				rows: [
					{ label: "Périgée", value: formatKm(item.perigee) },
					{ label: "Apogée", value: formatKm(item.apogee) },
				],
			}),
			event,
		);
	};

	root
		.append("rect")
		.attr("aria-hidden", "true")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", innerWidth)
		.attr("height", innerHeight)
		.attr("fill", "transparent")
		.on("pointermove", (event: PointerEvent) => {
			showPointTooltip(event);
		})
		.on("pointerleave", hidePointTooltip);

	const updateHighlight = (orbitClass: string | null) => {
		pointsImage.attr("href", getScatterImage(orbitClass));
	};

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 150}, ${chartFrame.contentTop + 32})`,
		);

	appendLegend(legend, {
		title: "Classes d'orbite",
		x: 0,
		y: 0,
		items: classes.map((orbitClass) => ({
			label: `${orbitClass} (${symbolNameForClass(orbitClass)})`,
			color: colorFromMap(orbitPalette, orbitClass),
			onPointerEnter: () => updateHighlight(orbitClass),
			onPointerLeave: () => updateHighlight(null),
		})),
		rowGap: 32,
	});

	appendChartHeader(
		svg,
		"L'espace est fortement concentré en orbite basse",
		"Les échelles logarithmiques révèlent à la fois l'encombrement LEO et les orbites plus lointaines.",
	);

	appendAxisLabel(root, "Périgée (km)", innerWidth / 2, innerHeight + 58);
	appendAxisLabel(root, "Apogée (km)", -innerHeight / 2, -78, {
		rotate: -90,
	});

	appendDataTable({
		container,
		caption:
			"Statistiques par classe d'orbite (périgée et apogée médians, satellites recensés)",
		summary: description,
		columns: [
			{
				header: "Classe d'orbite",
				accessor: (row: OrbitClassSummary) =>
					`${row.orbitClass} (${symbolNameForClass(row.orbitClass)})`,
			},
			{
				header: "Satellites",
				accessor: (row: OrbitClassSummary) => formatCount(row.count),
			},
			{
				header: "Part",
				accessor: (row: OrbitClassSummary) =>
					`${Math.round(row.share * 100)} %`,
			},
			{
				header: "Périgée médian",
				accessor: (row: OrbitClassSummary) =>
					formatKm(Math.round(row.medianPerigee)),
			},
			{
				header: "Apogée médian",
				accessor: (row: OrbitClassSummary) =>
					formatKm(Math.round(row.medianApogee)),
			},
		],
		rows: summaries,
	});
}

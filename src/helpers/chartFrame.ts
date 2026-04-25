import type { Selection } from "d3";

import { stagePalette } from "./palette";

// biome-ignore lint/suspicious/noExplicitAny: D3 selections are loosely typed by design
type SvgSelection = Selection<any, any, any, any>;

export const chartFrame = {
	width: 960,
	height: 640,
	headerX: 70,
	titleY: 60,
	subtitleY: 92,
	contentTop: 136,
} as const;

export const chartTypography = {
	title: 30,
	subtitle: 15,
	axisTick: 12,
	axisLabel: 13,
	legendTitle: 12,
	legendLabel: 13,
	rowLabel: 16,
	rowValue: 15,
	rowMeta: 12,
	dataLabel: 13,
	listLabel: 11,
	annotation: 12,
	centerEyebrow: 15,
	centerValue: 44,
	centerCaption: 15,
} as const;

export const chartMargins = {
	barLegendWide: {
		top: chartFrame.contentTop,
		right: 280,
		bottom: 48,
		left: 210,
	},
	scatter: {
		top: chartFrame.contentTop,
		right: 170,
		bottom: 86,
		left: 98,
	},
	stackedBars: {
		top: chartFrame.contentTop,
		right: 130,
		bottom: 64,
		left: 220,
	},
	timeline: {
		top: chartFrame.contentTop,
		right: 90,
		bottom: 66,
		left: 78,
	},
	ridge: {
		top: 170,
		right: 188,
		bottom: 48,
		left: 140,
	},
} as const;

export const chartInteraction = {
	duration: 220,
	idle: 1,
	lineIdle: 0.55,
	active: 0.95,
	muted: 0.18,
	softMuted: 0.28,
	faint: 0.12,
	lineMuted: 0.08,
	lineFaint: 0.06,
} as const;

export function appendChartHeader(
	svg: Selection<SVGSVGElement, unknown, null, undefined>,
	title: string,
	subtitle: string,
) {
	svg
		.append("text")
		.attr("x", chartFrame.headerX)
		.attr("y", chartFrame.titleY)
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.title)
		.attr("font-weight", 700)
		.text(title);

	svg
		.append("text")
		.attr("x", chartFrame.headerX)
		.attr("y", chartFrame.subtitleY)
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.subtitle)
		.text(subtitle);
}

export function appendSectionLabel(
	parent: SvgSelection,
	text: string,
	x: number,
	y: number,
	options: { anchor?: "start" | "middle" | "end"; fill?: string } = {},
) {
	return parent
		.append("text")
		.attr("x", x)
		.attr("y", y)
		.attr("text-anchor", options.anchor ?? "start")
		.attr("fill", options.fill ?? stagePalette.highlight)
		.attr("font-size", chartTypography.legendTitle)
		.attr("font-weight", 600)
		.attr("letter-spacing", "0.12em")
		.text(text.toUpperCase());
}

export function appendAxisLabel(
	parent: SvgSelection,
	text: string,
	x: number,
	y: number,
	options: {
		anchor?: "start" | "middle" | "end";
		fill?: string;
		rotate?: number;
	} = {},
) {
	const label = parent
		.append("text")
		.attr("x", x)
		.attr("y", y)
		.attr("text-anchor", options.anchor ?? "middle")
		.attr("fill", options.fill ?? stagePalette.muted)
		.attr("font-size", chartTypography.axisLabel)
		.text(text);

	if (options.rotate) {
		label.attr("transform", `rotate(${options.rotate})`);
	}

	return label;
}

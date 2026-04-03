import type { Selection } from "d3";

import { chartTypography } from "./chartFrame";
import { stagePalette } from "./palette";

interface AxisStyleOptions {
	fontSize?: number;
	hideDomain?: boolean;
	hideTickLines?: boolean;
	lineColor?: string;
	textColor?: string;
}

type AxisSelection = Selection<SVGGElement, unknown, null, undefined>;

export function styleAxis(axis: AxisSelection, options: AxisStyleOptions = {}) {
	const {
		fontSize = chartTypography.axisTick,
		hideDomain = false,
		hideTickLines = false,
		lineColor = stagePalette.line,
		textColor = stagePalette.muted,
	} = options;

	if (hideDomain) {
		axis.select(".domain").remove();
	} else {
		axis.select(".domain").attr("stroke", lineColor);
	}

	if (hideTickLines) {
		axis.selectAll("line").remove();
	} else {
		axis.selectAll("line").attr("stroke", lineColor);
	}

	axis.selectAll("text").attr("fill", textColor).attr("font-size", fontSize);

	return axis;
}

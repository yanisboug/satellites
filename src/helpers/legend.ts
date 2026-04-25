import { type BaseType, type Selection, select } from "d3";

import { appendSectionLabel, chartTypography } from "./chartFrame";
import { stagePalette } from "./palette";

type SvgParent =
	| Selection<SVGSVGElement, unknown, null, undefined>
	| Selection<SVGGElement, unknown, null, undefined>;

type LegendMarker =
	| { type: "circle"; size?: number }
	| { type: "rect"; width?: number; height?: number; rx?: number }
	| { type: "line"; length?: number; strokeWidth?: number };

interface LegendItem {
	color: string;
	label: string;
	marker?: LegendMarker;
	onPointerEnter?: () => void;
	onPointerLeave?: () => void;
	textColor?: string;
}

interface LegendOptions {
	columnGap?: number;
	direction?: "horizontal" | "vertical";
	items: LegendItem[];
	rowGap?: number;
	title?: string;
	x: number;
	y: number;
}

function getTextOffset(marker?: LegendMarker) {
	if (!marker || marker.type === "circle") {
		return 22;
	}
	if (marker.type === "rect") {
		return (marker.width ?? 14) + 8;
	}
	return (marker.length ?? 18) + 6;
}

function appendMarker(
	group: Selection<SVGGElement, LegendItem, BaseType, unknown>,
	item: LegendItem,
) {
	const marker = item.marker;

	if (!marker || marker.type === "circle") {
		const size = marker?.size ?? 14;
		group
			.append("circle")
			.attr("cx", size / 2)
			.attr("cy", size / 2)
			.attr("r", size / 2)
			.attr("fill", item.color);
		return;
	}

	if (marker.type === "rect") {
		group
			.append("rect")
			.attr("width", marker.width ?? 14)
			.attr("height", marker.height ?? 14)
			.attr("rx", marker.rx ?? 4)
			.attr("fill", item.color);
		return;
	}

	group
		.append("line")
		.attr("x1", 0)
		.attr("x2", marker.length ?? 18)
		.attr("y1", 7)
		.attr("y2", 7)
		.attr("stroke", item.color)
		.attr("stroke-width", marker.strokeWidth ?? 3)
		.attr("stroke-linecap", "round");
}

export function appendLegend(parent: SvgParent, options: LegendOptions) {
	const {
		columnGap = 220,
		direction = "vertical",
		items,
		rowGap = 28,
		title,
		x,
		y,
	} = options;

	const legend = parent.append("g").attr("transform", `translate(${x}, ${y})`);
	const itemsOffsetY = title ? 18 : 0;

	if (title) {
		appendSectionLabel(legend, title, 0, 0);
	}

	const itemGroups = legend
		.selectAll<SVGGElement, LegendItem>("g")
		.data(items)
		.join("g")
		.attr("transform", (_, index) =>
			direction === "horizontal"
				? `translate(${index * columnGap}, ${itemsOffsetY})`
				: `translate(0, ${itemsOffsetY + index * rowGap})`,
		)
		.attr("tabindex", (item) =>
			item.onPointerEnter || item.onPointerLeave ? 0 : null,
		)
		.attr("role", (item) =>
			item.onPointerEnter || item.onPointerLeave ? "button" : null,
		)
		.attr("aria-label", (item) =>
			item.onPointerEnter || item.onPointerLeave
				? `Filtrer : ${item.label}`
				: null,
		)
		.style("cursor", (item) =>
			item.onPointerEnter || item.onPointerLeave ? "pointer" : null,
		)
		.on("pointerenter", (_, item) => item.onPointerEnter?.())
		.on("pointerleave", (_, item) => item.onPointerLeave?.())
		.on("focus", (_, item) => item.onPointerEnter?.())
		.on("blur", (_, item) => item.onPointerLeave?.())
		.on("keydown", (event: KeyboardEvent, item) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				item.onPointerEnter?.();
			}
			if (event.key === "Escape") {
				item.onPointerLeave?.();
				(event.currentTarget as HTMLElement | null)?.blur();
			}
		});

	itemGroups.each(function appendLegendItem(item) {
		const group = select<SVGGElement, LegendItem>(this);
		appendMarker(group, item);

		group
			.append("text")
			.attr("x", getTextOffset(item.marker))
			.attr("y", 11)
			.attr("fill", item.textColor ?? stagePalette.text)
			.attr("font-size", chartTypography.legendLabel)
			.text(item.label);
	});

	return legend;
}

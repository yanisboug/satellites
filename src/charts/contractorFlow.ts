import * as d3 from "d3";

import type { FlowLinkDatum, FlowNodeDatum } from "../types";
import { stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

interface FlowData {
	contractors: FlowNodeDatum[];
	sites: FlowNodeDatum[];
	links: FlowLinkDatum[];
}

interface PositionedNode extends FlowNodeDatum {
	x: number;
	y: number;
	width: number;
}

const textMeasureCanvas = document.createElement("canvas");
const textMeasureContext = textMeasureCanvas.getContext("2d");

function measureLabelWidth(label: string) {
	if (!textMeasureContext) {
		return 184;
	}
	textMeasureContext.font =
		'600 12.5px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
	return Math.ceil(textMeasureContext.measureText(label).width);
}

function getColumnWidth(labels: string[]) {
	const widestLabel = d3.max(labels, measureLabelWidth) ?? 0;
	return Math.max(156, Math.min(340, widestLabel + 36));
}

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderBreakdownTooltip(
	title: string,
	total: number,
	sectionLabel: string,
	rows: { label: string; value: number }[],
) {
	return `
		<div class="flow-tooltip">
			<div class="flow-tooltip-title">${escapeHtml(title)}</div>
			<div class="flow-tooltip-total">${d3.format(",")(total).replace(/,/g, " ")} satellites relies</div>
			<div class="flow-tooltip-section">${escapeHtml(sectionLabel)}</div>
			<div class="flow-tooltip-list">
				${rows
					.map(
						(row) => `
							<div class="flow-tooltip-row">
								<span class="flow-tooltip-label">${escapeHtml(row.label)}</span>
								<span class="flow-tooltip-value">${d3.format(",")(row.value).replace(/,/g, " ")}</span>
							</div>
						`,
					)
					.join("")}
			</div>
		</div>
	`;
}

export function renderContractorFlow(
	container: HTMLElement,
	flow: FlowData,
	tooltip: TooltipController,
) {
	const width = 960;
	const height = 640;
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr(
			"aria-label",
			"Diagramme de flux entre contracteurs et sites de lancement",
		);
	const contractorWidth = getColumnWidth(
		flow.contractors.map((node) => node.label),
	);
	const siteWidth = getColumnWidth(flow.sites.map((node) => node.label));
	const contractorLeft = 92;
	const siteRight = 910;
	const contractorX = contractorLeft + contractorWidth / 2;
	const siteX = siteRight - siteWidth / 2;
	const contractorNodes = flow.contractors.map((node, index) => ({
		...node,
		x: contractorX,
		y: 150 + index * 72,
		width: contractorWidth,
	}));
	const siteNodes = flow.sites.map((node, index) => ({
		...node,
		x: siteX,
		y: 150 + index * 72,
		width: siteWidth,
	}));
	const nodeLookup = new Map<string, PositionedNode>(
		[...contractorNodes, ...siteNodes].map((node) => [node.id, node]),
	);
	const linkScale = d3
		.scaleSqrt()
		.domain([0, d3.max(flow.links, (item) => item.value) ?? 0])
		.range([2, 18]);
	const formatCount = (value: number) =>
		d3.format(",")(value).replace(/,/g, " ");

	const getNodeBreakdown = (node: PositionedNode) => {
		const relatedLinks = flow.links
			.filter((link) =>
				node.side === "contractor"
					? link.source === node.id
					: link.target === node.id,
			)
			.map((link) => {
				const otherNodeId =
					node.side === "contractor" ? link.target : link.source;
				return {
					label: nodeLookup.get(otherNodeId)?.label ?? otherNodeId,
					value: link.value,
				};
			})
			.sort((left, right) => right.value - left.value);

		if (relatedLinks.length === 0) {
			return "";
		}

		return renderBreakdownTooltip(
			node.label,
			node.value,
			node.side === "contractor"
				? "Vers les sites de lancement"
				: "Satellites fournis par",
			relatedLinks,
		);
	};
	const contractorColor = "#2a9d8f";
	const siteColor = "#457b9d";

	const highlight = (nodeId: string | null) => {
		const connectedNodeIds = new Set<string>();
		if (nodeId) {
			flow.links.forEach((link) => {
				if (link.source === nodeId) {
					connectedNodeIds.add(link.target);
				}
				if (link.target === nodeId) {
					connectedNodeIds.add(link.source);
				}
			});
		}

		linkGroup
			.selectAll<SVGPathElement, FlowLinkDatum>("path")
			.style("opacity", (link) => {
				if (!nodeId) {
					return 0.55;
				}
				return link.source === nodeId || link.target === nodeId ? 0.95 : 0.08;
			});

		nodeGroup
			.selectAll<SVGGElement, PositionedNode>("g")
			.style("opacity", (node) => {
				if (!nodeId) {
					return 1;
				}
				return node.id === nodeId || connectedNodeIds.has(node.id) ? 1 : 0.22;
			});
	};

	const linkGroup = svg.append("g");
	const nodeGroup = svg.append("g");

	linkGroup
		.selectAll("path")
		.data(flow.links)
		.join("path")
		.attr("d", (link) => {
			const source = nodeLookup.get(link.source);
			const target = nodeLookup.get(link.target);
			if (!source || !target) {
				return "";
			}
			const sourceEdge = source.x + source.width / 2;
			const targetEdge = target.x - target.width / 2;
			return `M ${sourceEdge} ${source.y} C ${sourceEdge + 150} ${source.y}, ${targetEdge - 150} ${target.y}, ${targetEdge} ${target.y}`;
		})
		.attr("fill", "none")
		.attr("stroke", "rgba(125, 211, 252, 0.45)")
		.attr("stroke-width", (link) => linkScale(link.value))
		.attr("stroke-linecap", "round")
		.on("pointerenter", (event, link) => {
			const sourceLabel = nodeLookup.get(link.source)?.label ?? link.source;
			const targetLabel = nodeLookup.get(link.target)?.label ?? link.target;
			highlight(link.source);
			tooltip.show(
				`<strong>${escapeHtml(sourceLabel)}</strong> → <strong>${escapeHtml(targetLabel)}</strong><br>${formatCount(link.value)} satellites`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		});

	const renderNodes = (nodes: PositionedNode[], fill: string) => {
		const groups = nodeGroup
			.selectAll(`.${nodes[0]?.side ?? "node"}-node`)
			.data(nodes)
			.join("g")
			.attr("transform", (node) => `translate(${node.x}, ${node.y})`)
			.style("cursor", "pointer")
			.on("pointerenter", (event, node) => {
				highlight(node.id);
				tooltip.show(getNodeBreakdown(node), event, {
					placement: node.side === "contractor" ? "left" : "right",
				});
			})
			.on("pointermove", (event, node) =>
				tooltip.move(event, {
					placement: node.side === "contractor" ? "left" : "right",
				}),
			)
			.on("pointerleave", () => {
				highlight(null);
				tooltip.hide();
			});

		groups
			.append("rect")
			.attr("x", (node) => -node.width / 2)
			.attr("y", -18)
			.attr("width", (node) => node.width)
			.attr("height", 36)
			.attr("rx", 18)
			.attr("fill", fill)
			.attr("fill-opacity", 0.18)
			.attr("stroke", fill)
			.attr("stroke-opacity", 0.6);

		groups
			.append("text")
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "middle")
			.attr("fill", stagePalette.text)
			.attr("font-size", 12.5)
			.attr("font-weight", 600)
			.text((node) => node.label);
	};

	renderNodes(contractorNodes, contractorColor);
	renderNodes(siteNodes, siteColor);

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("Des chaines logistiques fortement concentrees");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Le survol isole la route habituelle d'un constructeur vers ses bases de lancement preferees.",
		);

	svg
		.append("text")
		.attr("x", contractorLeft)
		.attr("y", 126)
		.attr("fill", contractorColor)
		.attr("font-size", 12)
		.attr("letter-spacing", "0.14em")
		.text("CONTRACTEURS");

	svg
		.append("text")
		.attr("x", siteRight - siteWidth)
		.attr("y", 126)
		.attr("fill", siteColor)
		.attr("font-size", 12)
		.attr("letter-spacing", "0.14em")
		.text("SITES");
}

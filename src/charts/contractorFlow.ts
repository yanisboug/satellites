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
	const contractorX = 170;
	const siteX = 780;
	const contractorNodes = flow.contractors.map((node, index) => ({
		...node,
		x: contractorX,
		y: 150 + index * 72,
	}));
	const siteNodes = flow.sites.map((node, index) => ({
		...node,
		x: siteX,
		y: 150 + index * 72,
	}));
	const nodeLookup = new Map<string, PositionedNode>(
		[...contractorNodes, ...siteNodes].map((node) => [node.id, node]),
	);
	const linkScale = d3
		.scaleSqrt()
		.domain([0, d3.max(flow.links, (item) => item.value) ?? 0])
		.range([2, 18]);
	const contractorColor = "#2a9d8f";
	const siteColor = "#457b9d";

	const highlight = (nodeId: string | null) => {
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
				return node.id === nodeId ? 1 : 0.22;
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
			return `M ${source.x + 78} ${source.y} C ${source.x + 240} ${source.y}, ${target.x - 240} ${target.y}, ${target.x - 78} ${target.y}`;
		})
		.attr("fill", "none")
		.attr("stroke", "rgba(125, 211, 252, 0.45)")
		.attr("stroke-width", (link) => linkScale(link.value))
		.attr("stroke-linecap", "round")
		.on("pointerenter", (event, link) => {
			tooltip.show(
				`<strong>${link.source}</strong> → <strong>${nodeLookup.get(link.target)?.label ?? link.target}</strong><br>${d3.format(",")(link.value).replace(/,/g, " ")} satellites`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	const renderNodes = (nodes: PositionedNode[], fill: string) => {
		const groups = nodeGroup
			.selectAll(`.${nodes[0]?.side ?? "node"}-node`)
			.data(nodes)
			.join("g")
			.attr("transform", (node) => `translate(${node.x}, ${node.y})`)
			.style("cursor", "pointer")
			.on("pointerenter", (event, node) => {
				highlight(node.id);
				tooltip.show(
					`<strong>${node.label}</strong><br>${d3.format(",")(node.value).replace(/,/g, " ")} satellites relies`,
					event,
				);
			})
			.on("pointermove", (event) => tooltip.move(event))
			.on("pointerleave", () => {
				highlight(null);
				tooltip.hide();
			});

		groups
			.append("rect")
			.attr("x", -78)
			.attr("y", -18)
			.attr("width", 156)
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
		.attr("x", 110)
		.attr("y", 126)
		.attr("fill", contractorColor)
		.attr("font-size", 12)
		.attr("letter-spacing", "0.14em")
		.text("CONTRACTEURS");

	svg
		.append("text")
		.attr("x", 740)
		.attr("y", 126)
		.attr("fill", siteColor)
		.attr("font-size", 12)
		.attr("letter-spacing", "0.14em")
		.text("SITES");
}

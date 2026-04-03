import * as d3 from "d3";
import { styleAxis } from "../helpers/axis";
import {
	appendAxisLabel,
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
	chartTypography,
} from "../helpers/chartFrame";
import {
	formatCount,
	formatDecimal,
	formatPercent,
} from "../helpers/formatters";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { AgeGroupDatum } from "../types";

type DensityPoint = [number, number];
const AGE_CAP = 30;

function gaussianKernel(bandwidth: number) {
	return (value: number) =>
		Math.exp(-(value * value) / (2 * bandwidth * bandwidth));
}

function kernelDensityEstimator(
	domain: number[],
	samples: number[],
	bandwidth: number,
) {
	const kernel = gaussianKernel(bandwidth);
	return domain.map<DensityPoint>((x) => {
		const total = samples.reduce((sum, sample) => sum + kernel(x - sample), 0);
		return [x, samples.length === 0 ? 0 : total / samples.length];
	});
}

export function renderAgeRidge(
	container: HTMLElement,
	data: AgeGroupDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.ridge;
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const domain = d3.range(0, AGE_CAP + 0.25, 0.25);
	const densities = data.map((group) => ({
		...group,
		cutoffCount: group.ages.filter((age) => age > AGE_CAP).length,
		density: kernelDensityEstimator(
			domain,
			group.ages,
			group.id === "mega" ? 0.7 : 1,
		),
	}));
	const x = d3
		.scaleLinear()
		.domain([0, AGE_CAP])
		.range([0, innerWidth])
		.clamp(true);
	const ridgeScale = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(
				densities,
				(group) => d3.max(group.density, (point) => point[1]) ?? 0,
			) ?? 0,
		])
		.range([0, 90]);
	const y = d3
		.scalePoint<string>()
		.domain(densities.map((item) => item.label))
		.range([0, innerHeight])
		.padding(0.18);
	const area = d3
		.area<DensityPoint>()
		.x((point) => x(point[0]))
		.y0(0)
		.y1((point) => -ridgeScale(point[1]))
		.curve(d3.curveBasis);
	const line = d3
		.line<DensityPoint>()
		.x((point) => x(point[0]))
		.y((point) => -ridgeScale(point[1]))
		.curve(d3.curveBasis);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Ridge plot sur l'âge des satellites");
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(d3.axisBottom(x).ticks(8))
		.call((axis) => styleAxis(axis));

	root
		.append("g")
		.call(d3.axisLeft(y).tickSize(0))
		.call((axis) =>
			styleAxis(axis, {
				hideDomain: true,
				hideTickLines: true,
				fontSize: 14,
				textColor: stagePalette.text,
			}),
		);

	root
		.selectAll(".tick text")
		.attr("dy", "0em")
		.attr("dominant-baseline", "alphabetic");

	const groups = root
		.selectAll(".ridge")
		.data(densities)
		.join("g")
		.attr("class", "ridge")
		.attr("transform", (group) => `translate(0, ${y(group.label) ?? 0})`);

	groups
		.append("path")
		.attr("fill", (group) => group.color)
		.attr("fill-opacity", 0.7)
		.attr("d", (group) => area(group.density));

	groups
		.append("path")
		.attr("fill", stagePalette.expired)
		.attr("fill-opacity", 0.85)
		.attr("d", (group) => {
			const expiredDensity = group.density.filter(
				(point) => point[0] >= group.medianLifetime,
			);
			if (expiredDensity.length < 2) {
				return "";
			}
			return area(expiredDensity);
		});

	groups
		.append("path")
		.attr("fill", "none")
		.attr("stroke", "rgba(255,255,255,0.7)")
		.attr("stroke-width", 1.4)
		.attr("d", (group) => line(group.density));

	groups
		.filter((group) => group.cutoffCount > 0)
		.append("line")
		.attr("x1", x(AGE_CAP))
		.attr("x2", x(AGE_CAP))
		.attr("y1", 0)
		.attr(
			"y2",
			(group) => -ridgeScale(group.density[group.density.length - 1]?.[1] ?? 0),
		)
		.attr("stroke", "rgba(255,255,255,0.55)")
		.attr("stroke-width", 1.2)
		.attr("stroke-dasharray", "3 3");

	groups
		.filter((group) => group.cutoffCount > 0)
		.append("circle")
		.attr("cx", x(AGE_CAP))
		.attr(
			"cy",
			(group) => -ridgeScale(group.density[group.density.length - 1]?.[1] ?? 0),
		)
		.attr("r", 3.5)
		.attr("fill", stagePalette.text)
		.attr("stroke", (group) => group.color)
		.attr("stroke-width", 1.5);

	groups
		.append("line")
		.attr("x1", (group) => x(group.medianLifetime))
		.attr("x2", (group) => x(group.medianLifetime))
		.attr("y1", 0)
		.attr("y2", -96)
		.attr("stroke", "rgba(255,255,255,0.8)")
		.attr("stroke-width", 1.4)
		.attr("stroke-dasharray", "5 5");

	groups
		.append("rect")
		.attr("x", 0)
		.attr("y", -110)
		.attr("width", innerWidth)
		.attr("height", 120)
		.attr("fill", "transparent")
		.on("pointerenter", (event, group) => {
			highlight(group.id);
			const extraRows =
				group.cutoffCount > 0
					? [
							{
								label: `Au-delà de ${AGE_CAP} ans`,
								value: formatCount(group.cutoffCount),
							},
						]
					: [];
			tooltip.show(
				buildTooltip({
					title: group.label,
					rows: [
						{
							label: "Âge médian",
							value: `${formatDecimal(group.medianAge)} ans`,
						},
						{
							label: "Durée de vie médiane",
							value: `${formatDecimal(group.medianLifetime)} ans`,
						},
						{
							label: "Satellites expirés",
							value: formatPercent(group.expiredShare),
						},
						{ label: "Total", value: formatCount(group.total) },
						...extraRows,
					],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		});

	function highlight(groupId: string | null) {
		groups
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (group) =>
				!groupId || group.id === groupId
					? chartInteraction.idle
					: chartInteraction.muted,
			);
	}

	groups
		.append("text")
		.attr("x", innerWidth + 126)
		.attr("y", -60)
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.expired)
		.attr("font-size", chartTypography.dataLabel)
		.attr("font-weight", 700)
		.text((group) => `${formatPercent(group.expiredShare)} hors seuil`);

	groups
		.filter((group) => group.cutoffCount > 0)
		.append("text")
		.attr("x", innerWidth + 126)
		.attr("y", -40)
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.rowMeta)
		.attr("font-weight", 600)
		.text(
			(group) => `${formatCount(group.cutoffCount)} au-delà de ${AGE_CAP} ans`,
		);

	appendAxisLabel(
		root,
		`Âge des satellites actifs (ans, tronqué à ${AGE_CAP})`,
		innerWidth / 2,
		innerHeight + 34,
	);

	appendChartHeader(
		svg,
		"Des flottes très jeunes, mais pas toutes au même rythme",
		"Les méga-constellations restent très récentes, tandis que d'autres catégories s'approchent ou dépassent leur durée de vie.",
	);
}

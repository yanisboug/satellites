import * as d3 from "d3";

const integerFormatter = new Intl.NumberFormat("fr-CA");

function getDecimalFormatter(digits: number) {
	return new Intl.NumberFormat("fr-CA", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
}

export function formatCount(value: number) {
	return integerFormatter.format(value);
}

export function formatPercent(value: number, digits = 0) {
	return `${getDecimalFormatter(digits).format(value * 100)} %`;
}

export function formatDecimal(value: number, digits = 1) {
	return getDecimalFormatter(digits).format(value);
}

export function formatCompactTick(value: number) {
	return d3.format(".2s")(value).replace("G", "Md");
}

export function formatKm(value: number) {
	return `${formatCount(value)} km`;
}

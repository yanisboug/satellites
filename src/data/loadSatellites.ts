import type { SatelliteDataset } from "../types";

function getDataUrl(pathname: string) {
	return new URL(pathname, window.location.href).toString();
}

export async function loadSatellites() {
	const relativePath = `${import.meta.env.BASE_URL}data/satellites.json`;
	const response = await fetch(getDataUrl(relativePath));

	if (!response.ok) {
		throw new Error(`Impossible de charger les donnees (${response.status}).`);
	}

	return (await response.json()) as SatelliteDataset;
}

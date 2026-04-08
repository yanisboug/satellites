import type { SatelliteDataset } from "../types";

export async function loadSatellites() {
	const response = await fetch(
		`${import.meta.env.BASE_URL}data/satellites.json`,
	);

	if (!response.ok) {
		throw new Error(`Impossible de charger les donnees (${response.status}).`);
	}

	return (await response.json()) as SatelliteDataset;
}

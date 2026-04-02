import type {
	AgeGroupDatum,
	ContractorDatum,
	DerivedMetrics,
	FlowLinkDatum,
	FlowNodeDatum,
	NormalizedSatellite,
	OperatorDatum,
	OrbitMissionDatum,
	OrbitScatterDatum,
	SatelliteDataset,
	SatelliteRecord,
	SummaryMetric,
	YearSiteDatum,
} from "../types";

const launchSiteCountries = new Map<string, string>([
	["Cape Canaveral", "USA"],
	["Vandenberg AFB", "USA"],
	["Baikonur Cosmodrome", "Kazakhstan"],
	["Guiana Space Center", "France"],
	["Vostochny Cosmodrome", "Russia"],
	["Satish Dhawan Space Centre", "India"],
	["Jiuquan Satellite Launch Center", "China"],
	["Taiyuan Launch Center", "China"],
]);

const ageGroupColors = {
	civil: "#6baed6",
	communication: "#f4a261",
	military: "#7a5195",
	mega: "#2a9d8f",
};

function cleanLabel(
	value: string | null | undefined,
	fallback = "Non précisé",
) {
	const raw = value ?? "";
	const normalized = raw.replace(/\u00a0/g, " ").trim();
	return normalized.length > 0 ? normalized : fallback;
}

function normalizeCountry(value: string) {
	const cleaned = cleanLabel(value);
	if (cleaned === "UK") {
		return "United Kingdom";
	}
	return cleaned;
}

function normalizeClassOrbit(value: string) {
	const cleaned = cleanLabel(value, "Non précisée");
	return cleaned.toUpperCase() === "LEO" ? "LEO" : cleaned;
}

function normalizeTypeOrbit(value: string) {
	const cleaned = cleanLabel(value, "Non précisée");
	return cleaned === "nan" ? "Non précisée" : cleaned;
}

function formatLaunchSiteLabel(site: string) {
	const country = launchSiteCountries.get(site);
	return country ? `${site} (${country})` : site;
}

function classifyUserBucket(users: string) {
	const lowered = users.toLowerCase();
	if (lowered.includes("military")) {
		return "Militaire" as const;
	}
	if (lowered.includes("commercial")) {
		return "Commercial" as const;
	}
	return "Autre" as const;
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
	return items.reduce((accumulator, item) => {
		const key = keyFn(item);
		accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
		return accumulator;
	}, new Map<string, number>());
}

function median(values: number[]) {
	if (values.length === 0) {
		return 0;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

function summarizeShares(map: Map<string, number>, total: number) {
	return [...map.entries()].map(([label, count]) => ({
		label,
		count,
		share: count / total,
	}));
}

function normalizeSatellite(
	satellite: SatelliteRecord,
	megaOperators: Set<string>,
): NormalizedSatellite {
	const contractorLabel = cleanLabel(satellite.contractor);
	const operatorLabel = cleanLabel(satellite.operator);
	const purposeLabel = cleanLabel(satellite.purpose);
	const classOrbitLabel = normalizeClassOrbit(satellite.classOrbit);
	const typeOrbitLabel = normalizeTypeOrbit(satellite.typeOrbit);
	const usersLabel = cleanLabel(satellite.users);
	const countryContractorLabel = normalizeCountry(satellite.countryContractor);
	const launchSiteLabel = cleanLabel(satellite.launchSite);
	const launchDateValue = new Date(satellite.launchDate);
	const launchYear = launchDateValue.getUTCFullYear();
	const userBucket = classifyUserBucket(usersLabel);
	const isMegaConstellation = megaOperators.has(operatorLabel);
	const isExpired =
		typeof satellite.expectedLifetime === "number" &&
		satellite.expectedLifetime > 0 &&
		satellite.ageYears > satellite.expectedLifetime;

	return {
		...satellite,
		launchDateValue,
		launchYear,
		usersLabel,
		purposeLabel,
		classOrbitLabel,
		typeOrbitLabel,
		contractorLabel,
		operatorLabel,
		countryContractorLabel,
		launchSiteLabel,
		userBucket,
		isCommercial: userBucket === "Commercial",
		isMilitary: usersLabel.toLowerCase().includes("military"),
		isExpired,
		isMegaConstellation,
	};
}

function getMegaOperators(satellites: SatelliteRecord[]) {
	const grouped = new Map<string, { total: number; communications: number }>();

	for (const satellite of satellites) {
		const operator = cleanLabel(satellite.operator);
		const current = grouped.get(operator) ?? { total: 0, communications: 0 };
		current.total += 1;
		if (cleanLabel(satellite.purpose) === "Communications") {
			current.communications += 1;
		}
		grouped.set(operator, current);
	}

	return new Set(
		[...grouped.entries()]
			.filter(
				([, value]) =>
					value.total >= 400 && value.communications / value.total >= 0.6,
			)
			.map(([operator]) => operator),
	);
}

function buildSummary(
	satellites: NormalizedSatellite[],
	topOperators: OperatorDatum[],
	topLaunchSite: [string, number] | undefined,
): SummaryMetric {
	const totalSatellites = satellites.length;
	const commercialShare =
		satellites.filter((satellite) => satellite.userBucket === "Commercial")
			.length / totalSatellites;
	const leoShare =
		satellites.filter((satellite) => satellite.classOrbitLabel === "LEO")
			.length / totalSatellites;
	const dominantOperator = topOperators[0] ?? {
		name: "N/A",
		count: 0,
		share: 0,
	};

	return {
		totalSatellites,
		commercialShare,
		leoShare,
		dominantOperator,
		topLaunchSite: {
			name: topLaunchSite?.[0] ?? "N/A",
			count: topLaunchSite?.[1] ?? 0,
		},
	};
}

function buildTopContractors(satellites: NormalizedSatellite[]) {
	const grouped = new Map<string, ContractorDatum>();

	for (const satellite of satellites) {
		const key = satellite.contractorLabel;
		const current = grouped.get(key) ?? {
			name: key,
			country: satellite.countryContractorLabel,
			count: 0,
			share: 0,
		};
		current.count += 1;
		grouped.set(key, current);
	}

	const total = satellites.length;
	return [...grouped.values()]
		.sort((left, right) => right.count - left.count)
		.slice(0, 5)
		.map((item) => ({ ...item, share: item.count / total }));
}

function buildTopOperators(satellites: NormalizedSatellite[]) {
	const grouped = new Map<
		string,
		{ count: number; countries: Map<string, number> }
	>();

	for (const satellite of satellites) {
		const name = satellite.operatorLabel;
		const country = normalizeCountry(satellite.countryOperator);
		const entry = grouped.get(name) ?? {
			count: 0,
			countries: new Map<string, number>(),
		};
		entry.count += 1;
		entry.countries.set(country, (entry.countries.get(country) ?? 0) + 1);
		grouped.set(name, entry);
	}

	const total = satellites.length;
	return [...grouped.entries()]
		.sort((left, right) => right[1].count - left[1].count)
		.slice(0, 12)
		.map(([name, { count, countries }]) => {
			const dominantCountry =
				[...countries.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Autre";
			return { name, country: dominantCountry, count, share: count / total };
		});
}

function buildUsageShares(satellites: NormalizedSatellite[]) {
	const grouped = countBy(satellites, (satellite) => satellite.userBucket);
	return summarizeShares(grouped, satellites.length).sort(
		(left, right) => right.count - left.count,
	);
}

function buildOrbitScatter(satellites: NormalizedSatellite[]) {
	return satellites
		.filter((satellite) => satellite.perigee > 0 && satellite.apogee > 0)
		.map<OrbitScatterDatum>((satellite) => ({
			name: satellite.name,
			perigee: satellite.perigee,
			apogee: satellite.apogee,
			classOrbit: satellite.classOrbitLabel,
			typeOrbit: satellite.typeOrbitLabel,
			purpose: satellite.purposeLabel,
			operator: satellite.operatorLabel,
		}));
}

function buildOrbitMissionMix(satellites: NormalizedSatellite[]) {
	const grouped = new Map<string, OrbitMissionDatum>();

	for (const satellite of satellites) {
		const key = satellite.typeOrbitLabel;
		const current = grouped.get(key) ?? {
			typeOrbit: key,
			commercial: 0,
			other: 0,
			total: 0,
		};
		current.total += 1;
		if (satellite.userBucket === "Commercial") {
			current.commercial += 1;
		} else {
			current.other += 1;
		}
		grouped.set(key, current);
	}

	return [...grouped.values()]
		.sort((left, right) => right.total - left.total)
		.slice(0, 6);
}

function buildLaunchTimeline(satellites: NormalizedSatellite[]) {
	const topSites = [
		...countBy(satellites, (satellite) => satellite.launchSiteLabel).entries(),
	]
		.sort((left, right) => right[1] - left[1])
		.slice(0, 5)
		.map(([site]) => site);
	const selectedSites = new Set(topSites);
	const grouped = new Map<string, YearSiteDatum>();

	for (const satellite of satellites) {
		const site = selectedSites.has(satellite.launchSiteLabel)
			? satellite.launchSiteLabel
			: "Autres sites";
		const key = `${satellite.launchYear}-${site}`;
		const current = grouped.get(key) ?? {
			year: satellite.launchYear,
			site,
			label: site === "Autres sites" ? site : formatLaunchSiteLabel(site),
			count: 0,
		};
		current.count += 1;
		grouped.set(key, current);
	}

	const clustersByYear = new Map<
		number,
		{ launchDates: Map<string, number> }
	>();

	for (const satellite of satellites) {
		const current = clustersByYear.get(satellite.launchYear) ?? {
			launchDates: new Map<string, number>(),
		};
		const dateKey = satellite.launchDateValue.toISOString().slice(0, 10);
		current.launchDates.set(
			dateKey,
			(current.launchDates.get(dateKey) ?? 0) + 1,
		);
		clustersByYear.set(satellite.launchYear, current);
	}

	const clusters = [...clustersByYear.entries()]
		.sort((left, right) => left[0] - right[0])
		.map(([year, value]) => {
			const counts = [...value.launchDates.values()];
			return {
				year,
				avgSatellitesPerLaunchDate:
					counts.reduce((sum, count) => sum + count, 0) / counts.length,
				maxSatellitesOnSingleDate: Math.max(...counts),
			};
		});

	return {
		sites: [...topSites, "Autres sites"],
		data: [...grouped.values()].sort((left, right) => left.year - right.year),
		clusters,
	};
}

function buildFlow(satellites: NormalizedSatellite[]) {
	const contractorTotals = [
		...countBy(satellites, (satellite) => satellite.contractorLabel).entries(),
	]
		.sort((left, right) => right[1] - left[1])
		.slice(0, 6);
	const contractorSet = new Set(contractorTotals.map(([name]) => name));
	const filtered = satellites.filter((satellite) =>
		contractorSet.has(satellite.contractorLabel),
	);
	const siteTotals = [
		...countBy(filtered, (satellite) => satellite.launchSiteLabel).entries(),
	]
		.sort((left, right) => right[1] - left[1])
		.slice(0, 6);
	const siteSet = new Set(siteTotals.map(([name]) => name));
	const linksMap = new Map<string, FlowLinkDatum>();

	for (const satellite of filtered) {
		const site = siteSet.has(satellite.launchSiteLabel)
			? satellite.launchSiteLabel
			: "Autres sites";
		const key = `${satellite.contractorLabel}__${site}`;
		const current = linksMap.get(key) ?? {
			source: satellite.contractorLabel,
			target: site,
			value: 0,
		};
		current.value += 1;
		linksMap.set(key, current);
	}

	const links = [...linksMap.values()]
		.filter((link) => link.value >= 12)
		.sort((left, right) => right.value - left.value);

	const contractors: FlowNodeDatum[] = contractorTotals.map(
		([label, value]) => ({
			id: label,
			label,
			value,
			side: "contractor",
		}),
	);
	const sites: FlowNodeDatum[] = [
		...siteTotals,
		["Autres sites", 0] as [string, number],
	].map(([label]) => {
		const value = links
			.filter((link) => link.target === label)
			.reduce((sum, link) => sum + link.value, 0);
		return {
			id: label,
			label: label === "Autres sites" ? label : formatLaunchSiteLabel(label),
			value,
			side: "site" as const,
		};
	});

	return { contractors, sites, links };
}

function buildAgeGroups(satellites: NormalizedSatellite[]) {
	const groups: AgeGroupDatum[] = [];

	const definitions = [
		{
			id: "civil",
			label: "Civil classique",
			color: ageGroupColors.civil,
			filter: (satellite: NormalizedSatellite) =>
				!satellite.isMegaConstellation &&
				!satellite.isMilitary &&
				satellite.purposeLabel !== "Communications",
		},
		{
			id: "communication",
			label: "Communication classique",
			color: ageGroupColors.communication,
			filter: (satellite: NormalizedSatellite) =>
				!satellite.isMegaConstellation &&
				satellite.purposeLabel === "Communications",
		},
		{
			id: "military",
			label: "Militaire classique",
			color: ageGroupColors.military,
			filter: (satellite: NormalizedSatellite) =>
				!satellite.isMegaConstellation && satellite.isMilitary,
		},
		{
			id: "mega",
			label: "Méga-constellations",
			color: ageGroupColors.mega,
			filter: (satellite: NormalizedSatellite) => satellite.isMegaConstellation,
		},
	];

	for (const definition of definitions) {
		const satellitesInGroup = satellites.filter(definition.filter);
		const ages = satellitesInGroup.map((satellite) => satellite.ageYears);
		const lifetimes = satellitesInGroup
			.map((satellite) => satellite.expectedLifetime)
			.filter(
				(value): value is number => typeof value === "number" && value > 0,
			);
		const expiredCount = satellitesInGroup.filter(
			(satellite) => satellite.isExpired,
		).length;

		groups.push({
			id: definition.id,
			label: definition.label,
			color: definition.color,
			ages,
			medianAge: median(ages),
			medianLifetime: median(lifetimes),
			expiredShare:
				satellitesInGroup.length > 0
					? expiredCount / satellitesInGroup.length
					: 0,
			total: satellitesInGroup.length,
		});
	}

	return groups;
}

export function deriveMetrics(dataset: SatelliteDataset): DerivedMetrics {
	const megaOperators = getMegaOperators(dataset.satellites);
	const satellites = dataset.satellites.map((satellite) =>
		normalizeSatellite(satellite, megaOperators),
	);
	const topContractors = buildTopContractors(satellites);
	const topOperators = buildTopOperators(satellites);
	const topLaunchSite = [
		...countBy(satellites, (satellite) => satellite.launchSiteLabel).entries(),
	].sort((left, right) => right[1] - left[1])[0];

	return {
		meta: dataset.meta,
		satellites,
		summary: buildSummary(satellites, topOperators, topLaunchSite),
		topContractors,
		topOperators,
		usageShares: buildUsageShares(satellites),
		orbitScatter: buildOrbitScatter(satellites),
		orbitMissionMix: buildOrbitMissionMix(satellites),
		launchTimeline: buildLaunchTimeline(satellites),
		flow: buildFlow(satellites),
		ageGroups: buildAgeGroups(satellites),
	};
}

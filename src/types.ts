export interface SatelliteRecord {
	name: string;
	countryRegistry: string;
	countryOperator: string;
	operator: string;
	users: string;
	purpose: string;
	classOrbit: string;
	typeOrbit: string;
	perigee: number;
	apogee: number;
	eccentricity: number;
	inclination: number;
	period: number;
	launchMass: number | null;
	dryMass: number | null;
	launchDate: string;
	expectedLifetime: number | null;
	contractor: string;
	countryContractor: string;
	launchSite: string;
	ageYears: number;
}

export interface SatelliteDataset {
	meta: {
		source: string;
		exportedAt: string;
		dataAsOf: string;
		rowCount: number;
	};
	satellites: SatelliteRecord[];
}

export interface NormalizedSatellite extends SatelliteRecord {
	launchDateValue: Date;
	launchYear: number;
	usersLabel: string;
	purposeLabel: string;
	classOrbitLabel: string;
	typeOrbitLabel: string;
	contractorLabel: string;
	operatorLabel: string;
	countryOperatorLabel: string;
	countryContractorLabel: string;
	launchSiteLabel: string;
	userBucket: "Commercial" | "Militaire" | "Autre";
	isCommercial: boolean;
	isMilitary: boolean;
	isExpired: boolean;
	isMegaConstellation: boolean;
}

export interface SummaryMetric {
	totalSatellites: number;
	commercialShare: number;
	leoShare: number;
	dominantOperator: {
		name: string;
		count: number;
		share: number;
	};
	topLaunchSite: {
		name: string;
		count: number;
	};
}

export interface ContractorDatum {
	name: string;
	country: string;
	count: number;
	share: number;
}

export interface OperatorDatum {
	name: string;
	/** Pays le plus fréquent parmi les satellites de cet opérateur (couleur = viz. constructeurs). */
	country: string;
	count: number;
	share: number;
}

export interface ShareDatum {
	label: string;
	count: number;
	share: number;
}

export interface OrbitScatterDatum {
	name: string;
	perigee: number;
	apogee: number;
	classOrbit: string;
	typeOrbit: string;
	purpose: string;
	operator: string;
}

export interface OrbitMissionDatum {
	typeOrbit: string;
	commercial: number;
	other: number;
	total: number;
}

export interface YearSiteDatum {
	year: number;
	site: string;
	label: string;
	count: number;
}

export interface ClusterMetric {
	year: number;
	avgSatellitesPerLaunchDate: number;
	maxSatellitesOnSingleDate: number;
}

export interface FlowNodeDatum {
	id: string;
	label: string;
	value: number;
	side: "contractor" | "site";
}

export interface FlowLinkDatum {
	source: string;
	target: string;
	value: number;
}

export interface AgeGroupDatum {
	id: string;
	label: string;
	color: string;
	ages: number[];
	medianAge: number;
	medianLifetime: number;
	expiredShare: number;
	total: number;
}

export interface DerivedMetrics {
	meta: SatelliteDataset["meta"];
	satellites: NormalizedSatellite[];
	summary: SummaryMetric;
	topContractors: ContractorDatum[];
	topOperators: OperatorDatum[];
	usageShares: ShareDatum[];
	orbitScatter: OrbitScatterDatum[];
	orbitMissionMix: OrbitMissionDatum[];
	launchTimeline: {
		sites: string[];
		data: YearSiteDatum[];
		clusters: ClusterMetric[];
	};
	flow: {
		contractors: FlowNodeDatum[];
		sites: FlowNodeDatum[];
		links: FlowLinkDatum[];
	};
	ageGroups: AgeGroupDatum[];
}

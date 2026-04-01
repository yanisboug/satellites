import type { DerivedMetrics } from "../types";

export interface StoryScene {
	id: string;
	kicker: string;
	title: string;
	lede: string;
	body: string;
	accent: string;
}

function formatInt(value: number) {
	return new Intl.NumberFormat("fr-CA").format(value);
}

function formatPercent(value: number) {
	return `${Math.round(value * 100)} %`;
}

export function buildScenes(metrics: DerivedMetrics): StoryScene[] {
	const topContractor = metrics.topContractors[0];
	const secondContractor = metrics.topContractors[1];
	const topOperator = metrics.topOperators[0];
	const topOrbit = metrics.orbitMissionMix[0];
	const latestCluster =
		metrics.launchTimeline.clusters.at(-2) ??
		metrics.launchTimeline.clusters.at(-1);
	const megaGroup = metrics.ageGroups.find((group) => group.id === "mega");

	return [
		{
			id: "intro",
			kicker: "Question centrale",
			title: "Qui occupe l'espace orbital aujourd'hui ?",
			lede: `Au 1 mai 2023, ${formatInt(metrics.summary.totalSatellites)} satellites actifs structurent deja une infrastructure orbitale devenue industrielle.`,
			body: `Le recit suit la concentration du pouvoir spatial: qui construit, qui opere, dans quelles orbites, depuis quelles bases et avec quel renouvellement de flotte.`,
			accent: `${formatPercent(metrics.summary.leoShare)} de la flotte se concentre deja en LEO.`,
		},
		{
			id: "contractors",
			kicker: "Visualisation 1",
			title: "La fabrication est dominee par un acteur hors norme",
			lede: `${topContractor?.name ?? "Le leader"} construit a lui seul ${formatInt(topContractor?.count ?? 0)} satellites, tres loin devant ${secondContractor?.name ?? "ses poursuivants"}.`,
			body: "Les barres horizontales rendent visibles a la fois la taille absolue du parc et la part relative de marche. Le poids americain ressort immediatement.",
			accent: `${formatPercent(topContractor?.share ?? 0)} du parc mondial est associe au premier contracteur.`,
		},
		{
			id: "operators",
			kicker: "Visualisation 2",
			title: "L'operation des satellites ressemble a un quasi-monopole",
			lede: `${topOperator?.name ?? "Le leader"} opere environ ${formatPercent(topOperator?.share ?? 0)} des satellites actifs.`,
			body: "La taille des bulles ne cherche pas la precision d'un axe: elle dramatise l'ecart de grandeur entre le premier acteur et le reste du secteur spatial.",
			accent:
				"Plus le cercle est grand, plus l'ecart de puissance devient tangible.",
		},
		{
			id: "usage",
			kicker: "Visualisation 3",
			title: "Le marche commercial prend l'essentiel de l'orbite",
			lede: `${formatPercent(metrics.summary.commercialShare)} des satellites actifs servent d'abord des usages commerciaux.`,
			body: "En ramenant les usages a trois familles, la lecture devient immediate: l'espace orbital actif est aujourd'hui d'abord un espace de services marchands.",
			accent:
				"Les usages militaires existent, mais ils ne definissent pas le volume total.",
		},
		{
			id: "orbits",
			kicker: "Visualisation 4",
			title: "L'organisation technique privilegie massivement l'orbite basse",
			lede: "Le nuage perigee-apogee montre une densite ecrasante a basse altitude, et donc une congestion surtout concentree en LEO.",
			body: "La diagonale repere les orbites presque circulaires. Les points qui s'en eloignent signalent des trajectoires plus elliptiques ou specialisees.",
			accent:
				"La structure orbitale est lisible comme une geographie technique.",
		},
		{
			id: "orbit-types",
			kicker: "Visualisation 5",
			title: "Toutes les orbites ne sont pas egales pour le commerce",
			lede: `${topOrbit?.typeOrbit ?? "Certaines trajectoires"} concentre le plus grand volume de missions, dont une forte majorite commerciales.`,
			body: "Les barres empilees comparent les types d'orbites les plus frequents et montrent ceux qui sont vraiment privilegies pour les activites privees.",
			accent:
				"L'orbite choisie traduit une strategie de couverture et de service.",
		},
		{
			id: "launches",
			kicker: "Visualisation 6",
			title: "L'expansion recente passe par quelques bases ultra-actives",
			lede: `La hausse recente s'accelere, et les regroupements de satellites par date de lancement atteignent environ ${latestCluster?.avgSatellitesPerLaunchDate.toFixed(1) ?? "0"} satellites en moyenne lors des dernieres annees completes.`,
			body: "Les barres empilees donnent la repartition par site; la ligne superposee montre que l'ere des lancements groupes change aussi le rythme de croissance.",
			accent:
				"Le volume annuel grimpe, mais la densification des tirs grimpe aussi.",
		},
		{
			id: "flow",
			kicker: "Visualisation 7",
			title: "Les constructeurs n'utilisent pas l'infrastructure au hasard",
			lede: "Le diagramme de flux met en evidence des routes privilegiees entre fabricants et sites de lancement.",
			body: "Quand un noeud s'illumine, on suit une chaine logistique precise. Certaines entreprises dependent clairement d'un nombre limite de bases.",
			accent:
				"Le reseau de lancement est concentre autant que le marche lui-meme.",
		},
		{
			id: "age",
			kicker: "Visualisation 8",
			title: "Le parc orbital se renouvelle a des vitesses tres differentes",
			lede: `Les mega-constellations restent tres jeunes, avec un age median d'environ ${megaGroup?.medianAge.toFixed(1) ?? "0"} ans.`,
			body: "Le ridge plot croise l'age, la duree de vie mediane et la part de satellites encore actifs au-dela de leur seuil theorique. Les formes racontent des strategies industrielles differentes.",
			accent:
				"Une flotte recente et massive n'a ni la meme inertie, ni les memes risques qu'une flotte plus ancienne.",
		},
	];
}

import { formatCount, formatPercent } from "../helpers/formatters";
import type { DerivedMetrics } from "../types";

export interface StoryScene {
	id: string;
	kicker: string;
	title: string;
	lede: string;
	body: string;
	accent: string;
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
			lede: `Au 1er mai 2023, ${formatCount(metrics.summary.totalSatellites)} satellites actifs structurent déjà une infrastructure orbitale devenue industrielle.`,
			body: `Le récit suit la concentration du pouvoir spatial: qui construit, qui opère, dans quelles orbites, depuis quelles bases et avec quel renouvellement de flotte.`,
			accent: `${formatPercent(metrics.summary.leoShare)} de la flotte se concentre déjà en LEO.`,
		},
		{
			id: "contractors",
			kicker: "Visualisation 1",
			title: "La fabrication est dominée par un acteur hors norme",
			lede: `${topContractor?.name ?? "Le leader"} construit à lui seul ${formatCount(topContractor?.count ?? 0)} satellites, très loin devant ${secondContractor?.name ?? "ses poursuivants"}.`,
			body: "Les barres horizontales rendent visibles à la fois la taille absolue du parc et la part relative de marché. Le poids américain ressort immédiatement.",
			accent: `${formatPercent(topContractor?.share ?? 0)} du parc mondial est associé au premier constructeur.`,
		},
		{
			id: "operators",
			kicker: "Visualisation 2",
			title: "L'opération des satellites ressemble à un quasi-monopole",
			lede: `${topOperator?.name ?? "Le leader"} opère environ ${formatPercent(topOperator?.share ?? 0)} des satellites actifs.`,
			body: "La taille des bulles ne cherche pas la précision d'un axe: elle dramatise l'écart de grandeur entre le premier acteur et le reste du secteur spatial.",
			accent:
				"Plus le cercle est grand, plus l'écart de puissance devient tangible.",
		},
		{
			id: "usage",
			kicker: "Visualisation 3",
			title: "Le marché commercial prend l'essentiel de l'orbite",
			lede: `${formatPercent(metrics.summary.commercialShare)} des satellites actifs servent d'abord des usages commerciaux.`,
			body: "En ramenant les usages à trois familles, la lecture devient immédiate: l'espace orbital actif est aujourd'hui d'abord un espace de services marchands.",
			accent:
				"Les usages militaires existent, mais ils ne définissent pas le volume total.",
		},
		{
			id: "orbits",
			kicker: "Visualisation 4",
			title: "L'organisation technique privilégie massivement l'orbite basse",
			lede: "Le nuage périgée-apogée montre une densité écrasante à basse altitude, et donc une congestion surtout concentrée en LEO.",
			body: "La diagonale repère les orbites presque circulaires. Les points qui s'en éloignent signalent des trajectoires plus elliptiques ou spécialisées.",
			accent:
				"La structure orbitale est lisible comme une géographie technique.",
		},
		{
			id: "orbit-types",
			kicker: "Visualisation 5",
			title: "Toutes les orbites ne sont pas égales pour le commerce",
			lede: `${topOrbit?.typeOrbit ?? "Certaines trajectoires"} concentre le plus grand volume de missions, dont une forte majorité commerciales.`,
			body: "Les barres empilées comparent les types d'orbites les plus fréquents et montrent ceux qui sont vraiment privilégiés pour les activités privées.",
			accent:
				"L'orbite choisie traduit une stratégie de couverture et de service.",
		},
		{
			id: "launches",
			kicker: "Visualisation 6",
			title: "L'expansion récente passe par quelques bases ultra-actives",
			lede: `La hausse récente s'accélère, et les regroupements de satellites par date de lancement atteignent environ ${latestCluster?.avgSatellitesPerLaunchDate.toFixed(1) ?? "0"} satellites en moyenne lors des dernières années complètes.`,
			body: "Les barres empilées donnent la répartition par site; la ligne superposée montre que l'ère des lancements groupés change aussi le rythme de croissance.",
			accent:
				"Le volume annuel grimpe, mais la densification des tirs grimpe aussi.",
		},
		{
			id: "flow",
			kicker: "Visualisation 7",
			title: "Les constructeurs n'utilisent pas l'infrastructure au hasard",
			lede: "La matrice croise les principaux fabricants avec leurs sites de lancement et révèle les couloirs logistiques dominants.",
			body: "Plus la cellule s'assombrit et plus la bulle grossit, plus le couple constructeur-site est intense. Quelques cases captent l'essentiel du trafic.",
			accent:
				"Le réseau de lancement est concentré autant que le marché lui-même.",
		},
		{
			id: "age",
			kicker: "Visualisation 8",
			title: "Le parc orbital se renouvelle à des vitesses très différentes",
			lede: `Les méga-constellations restent très jeunes, avec un âge médian d'environ ${megaGroup?.medianAge.toFixed(1) ?? "0"} ans.`,
			body: "Le ridge plot croise l'âge, la durée de vie médiane et la part de satellites encore actifs au-delà de leur seuil théorique. Les formes racontent des stratégies industrielles différentes.",
			accent:
				"Une flotte récente et massive n'a ni la même inertie, ni les mêmes risques qu'une flotte plus ancienne.",
		},
	];
}

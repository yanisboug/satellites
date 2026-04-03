import "./style.css";

import { renderAgeRidge } from "./charts/ageRidge";
import { renderContractorBars } from "./charts/contractorBars";
import { renderContractorFlow } from "./charts/contractorFlow";
import { renderIntroScene } from "./charts/introScene";
import { renderLaunchTimeline } from "./charts/launchTimeline";
import { renderOperatorBubbles } from "./charts/operatorBubbles";
import { renderOrbitScatter } from "./charts/orbitScatter";
import { renderOrbitTypeBars } from "./charts/orbitTypeBars";
import { renderUsageDonut } from "./charts/usageDonut";
import { deriveMetrics } from "./data/deriveMetrics";
import { loadSatellites } from "./data/loadSatellites";
import { createTooltip, type TooltipController } from "./helpers/tooltip";
import { escapeHtml } from "./helpers/tooltipContent";
import { buildScenes } from "./story/scenes";
import { createScrollController } from "./story/scrollController";
import type { DerivedMetrics } from "./types";

function requiredElement<T extends Element>(
	scope: Document | HTMLElement,
	selector: string,
) {
	const element = scope.querySelector<T>(selector);
	if (!element) {
		throw new Error(`Élément introuvable: ${selector}`);
	}
	return element;
}

function setActiveState(
	buttons: HTMLButtonElement[],
	activeIndex: number,
	updateSelected = false,
) {
	buttons.forEach((button, index) => {
		const isActive = index === activeIndex;
		button.dataset.active = String(isActive);
		if (updateSelected) {
			button.setAttribute("aria-selected", String(isActive));
		}
	});
}

function renderVisualizations(
	scope: HTMLElement,
	metrics: DerivedMetrics,
	tooltip: TooltipController,
) {
	const mount = <Data>(
		id: string,
		render: (
			container: HTMLElement,
			data: Data,
			controller: TooltipController,
		) => void,
		data: Data,
	) => {
		render(requiredElement(scope, `#viz-${id}`), data, tooltip);
	};

	renderIntroScene(requiredElement(scope, "#viz-intro"), metrics.summary);
	mount("contractors", renderContractorBars, metrics.topContractors);
	mount("operators", renderOperatorBubbles, metrics.topOperators);
	mount("usage", renderUsageDonut, metrics.usageShares);
	mount("orbits", renderOrbitScatter, metrics.orbitScatter);
	mount("orbit-types", renderOrbitTypeBars, metrics.orbitMissionMix);
	mount("launches", renderLaunchTimeline, metrics.launchTimeline);
	mount("flow", renderContractorFlow, metrics.flow);
	mount("age", renderAgeRidge, metrics.ageGroups);
}

function renderStoryShell(scenes: ReturnType<typeof buildScenes>) {
	const menuItems = scenes
		.map(
			(scene, index) => `
				<li role="none">
					<button type="button" class="nav-menu-item" role="option">
						<span class="nav-menu-item-num">${index + 1}</span>
						<span class="nav-menu-item-text">
							<span class="nav-menu-item-kicker">${escapeHtml(scene.kicker)}</span>
							<span class="nav-menu-item-title">${escapeHtml(scene.title)}</span>
						</span>
					</button>
				</li>
			`,
		)
		.join("");

	const sceneMarkup = scenes
		.map((scene) => {
			const copyMarkup = `
				<div class="scene-copy">
					<p class="step-kicker">${scene.kicker}</p>
					<h2>${scene.title}</h2>
					<p class="step-lede">${scene.lede}</p>
					<p>${scene.body}</p>
					<p class="step-accent">${scene.accent}</p>
				</div>
			`;

			if (scene.id === "intro") {
				return `
					<div class="scene-layer scene-layer--intro">
						<div class="scene-viz" id="viz-${scene.id}"></div>
						${copyMarkup}
					</div>
				`;
			}

			return `
				<div class="scene-layer scene-layer--split">
					<div class="scene-layout">
						${copyMarkup}
						<div class="scene-viz" id="viz-${scene.id}"></div>
					</div>
				</div>
			`;
		})
		.join("");

	return `
		<div class="story-viewport">
			<div class="nav-menu">
				<button
					type="button"
					class="nav-menu-toggle"
					id="nav-menu-toggle"
					aria-expanded="false"
					aria-controls="nav-menu-panel"
					aria-haspopup="dialog"
				>
					Visualisations
				</button>
				<div
					class="nav-menu-backdrop"
					id="nav-menu-backdrop"
					hidden
					aria-hidden="true"
				></div>
				<div
					class="nav-menu-panel"
					id="nav-menu-panel"
					role="dialog"
					aria-modal="true"
					aria-labelledby="nav-menu-title"
					hidden
				>
					<div class="nav-menu-header">
						<h3 class="nav-menu-title" id="nav-menu-title">Choisir une visualisation</h3>
						<button type="button" class="nav-menu-close" id="nav-menu-close" aria-label="Fermer le menu">
							<span aria-hidden="true">×</span>
						</button>
					</div>
					<ul class="nav-menu-list" role="listbox" aria-label="Liste des visualisations">
						${menuItems}
					</ul>
				</div>
			</div>

			${sceneMarkup}

			<div class="scene-nav">
				<div class="scene-progress">
					${scenes
						.map(
							(_, index) =>
								`<button class="progress-dot" type="button" aria-label="Aller à la scène ${index + 1}"></button>`,
						)
						.join("")}
				</div>
				<p class="scene-counter"><span id="stage-index">1</span> / ${scenes.length}</p>
				<p class="scroll-hint" id="scroll-hint">Défiler pour avancer</p>
			</div>
		</div>
	`;
}

async function bootstrap() {
	const app = document.querySelector<HTMLDivElement>("#app");
	if (!app) {
		return;
	}

	app.innerHTML = `
		<div class="loading-state">
			<p>Chargement du récit orbital...</p>
		</div>
	`;

	try {
		const dataset = await loadSatellites();
		const metrics = deriveMetrics(dataset);
		const scenes = buildScenes(metrics);

		app.innerHTML = renderStoryShell(scenes);

		const tooltip = createTooltip(document.body);
		renderVisualizations(app, metrics, tooltip);

		const layers = [...app.querySelectorAll<HTMLElement>(".scene-layer")];
		const dots = [...app.querySelectorAll<HTMLButtonElement>(".progress-dot")];
		const menuItems = [
			...app.querySelectorAll<HTMLButtonElement>(".nav-menu-item"),
		];
		const stageIndex = requiredElement<HTMLElement>(app, "#stage-index");
		const scrollHint = requiredElement<HTMLElement>(app, "#scroll-hint");
		const menuToggle = requiredElement<HTMLButtonElement>(
			app,
			"#nav-menu-toggle",
		);
		const menuPanel = requiredElement<HTMLElement>(app, "#nav-menu-panel");
		const menuBackdrop = requiredElement<HTMLElement>(
			app,
			"#nav-menu-backdrop",
		);
		const menuClose = requiredElement<HTMLButtonElement>(
			app,
			"#nav-menu-close",
		);

		const setMenuOpen = (open: boolean) => {
			menuPanel.toggleAttribute("hidden", !open);
			menuBackdrop.toggleAttribute("hidden", !open);
			menuToggle.setAttribute("aria-expanded", String(open));
			(open ? menuClose : menuToggle).focus();
		};

		const controller = createScrollController({
			layers,
			onSceneChange(index) {
				stageIndex.textContent = `${index + 1}`;
				setActiveState(dots, index);
				setActiveState(menuItems, index, true);
				if (index > 0) {
					scrollHint.dataset.hidden = "true";
				}
			},
		});

		const closeMenu = () => setMenuOpen(false);

		menuToggle.addEventListener("click", () => {
			setMenuOpen(menuPanel.hasAttribute("hidden"));
		});
		menuClose.addEventListener("click", closeMenu);
		menuBackdrop.addEventListener("click", closeMenu);

		menuItems.forEach((button, index) => {
			button.addEventListener("click", () => {
				controller.goTo(index);
				closeMenu();
			});
		});

		dots.forEach((button, index) => {
			button.addEventListener("click", () => {
				controller.goTo(index);
			});
		});

		document.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape" && !menuPanel.hasAttribute("hidden")) {
					event.preventDefault();
					closeMenu();
				}
			},
			true,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erreur inconnue.";
		app.innerHTML = `
			<div class="error-state">
				<h1>Impossible de charger la visualisation</h1>
				<p>${message}</p>
			</div>
		`;
	}
}

void bootstrap();

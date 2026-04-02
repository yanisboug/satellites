import "./style.css";

import { renderAgeRidge } from "./charts/ageRidge";
import { renderContractorBars } from "./charts/contractorBars";
import { renderContractorFlow } from "./charts/contractorFlow";
import { renderIntroScene } from "./charts/introScene";
import { renderLaunchTimeline } from "./charts/launchTimeline";
import { renderOperatorBubbles } from "./charts/operatorBubbles";
import { renderOrbitScatter } from "./charts/orbitScatter";
import { renderOrbitTypeBars } from "./charts/orbitTypeBars";
import { createTooltip } from "./charts/tooltip";
import { renderUsageDonut } from "./charts/usageDonut";
import { deriveMetrics } from "./data/deriveMetrics";
import { loadSatellites } from "./data/loadSatellites";
import { buildScenes } from "./story/scenes";
import { createScrollController } from "./story/scrollController";

function getRequiredElement<T extends HTMLElement>(selector: string) {
	const element = document.querySelector<T>(selector);
	if (!element) {
		throw new Error(`Élément introuvable: ${selector}`);
	}
	return element;
}

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderStoryShell(scenes: ReturnType<typeof buildScenes>) {
	const menuItems = scenes
		.map(
			(scene, index) => `
					<li role="none">
						<button type="button" class="nav-menu-item" role="option" data-scene-index="${index}">
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

			${scenes
				.map(
					(scene, index) => `
					<div class="scene-layer" data-scene-index="${index}">
						<div class="scene-viz" id="viz-${scene.id}"></div>
						<div class="scene-copy">
							<p class="step-kicker">${scene.kicker}</p>
							<h2>${scene.title}</h2>
							<p class="step-lede">${scene.lede}</p>
							<p>${scene.body}</p>
							<p class="step-accent">${scene.accent}</p>
						</div>
					</div>
				`,
				)
				.join("")}

			<div class="scene-nav">
				<div class="scene-progress">
					${scenes
						.map(
							(_, index) =>
								`<button class="progress-dot" type="button" data-scene-index="${index}" aria-label="Aller à la scène ${index + 1}"></button>`,
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

		renderIntroScene(getRequiredElement("#viz-intro"), metrics.summary);
		renderContractorBars(
			getRequiredElement("#viz-contractors"),
			metrics.topContractors,
			tooltip,
		);
		renderOperatorBubbles(
			getRequiredElement("#viz-operators"),
			metrics.topOperators,
			tooltip,
		);
		renderUsageDonut(
			getRequiredElement("#viz-usage"),
			metrics.usageShares,
			tooltip,
		);
		renderOrbitScatter(
			getRequiredElement("#viz-orbits"),
			metrics.orbitScatter,
			tooltip,
		);
		renderOrbitTypeBars(
			getRequiredElement("#viz-orbit-types"),
			metrics.orbitMissionMix,
			tooltip,
		);
		renderLaunchTimeline(
			getRequiredElement("#viz-launches"),
			metrics.launchTimeline,
			tooltip,
		);
		renderContractorFlow(
			getRequiredElement("#viz-flow"),
			metrics.flow,
			tooltip,
		);
		renderAgeRidge(getRequiredElement("#viz-age"), metrics.ageGroups, tooltip);

		const layers = [...document.querySelectorAll<HTMLElement>(".scene-layer")];
		const stageIndex = document.querySelector<HTMLElement>("#stage-index");
		const dots = [
			...document.querySelectorAll<HTMLButtonElement>(".progress-dot"),
		];
		const scrollHint = document.querySelector<HTMLElement>("#scroll-hint");
		const menuToggle =
			getRequiredElement<HTMLButtonElement>("#nav-menu-toggle");
		const menuPanel = getRequiredElement<HTMLElement>("#nav-menu-panel");
		const menuBackdrop = getRequiredElement<HTMLElement>("#nav-menu-backdrop");
		const menuClose = getRequiredElement<HTMLButtonElement>("#nav-menu-close");
		const menuItemsEls = [
			...document.querySelectorAll<HTMLButtonElement>(".nav-menu-item"),
		];

		const controller = createScrollController({
			sceneCount: scenes.length,
			layers,
			onSceneChange(index) {
				if (stageIndex) {
					stageIndex.textContent = `${index + 1}`;
				}
				dots.forEach((dot, dotIndex) => {
					dot.dataset.active = dotIndex === index ? "true" : "false";
				});
				menuItemsEls.forEach((item, itemIndex) => {
					item.dataset.active = itemIndex === index ? "true" : "false";
					item.setAttribute(
						"aria-selected",
						itemIndex === index ? "true" : "false",
					);
				});
				if (scrollHint && index > 0) {
					scrollHint.dataset.hidden = "true";
				}
			},
		});

		const openMenu = () => {
			menuPanel.removeAttribute("hidden");
			menuBackdrop.removeAttribute("hidden");
			menuToggle.setAttribute("aria-expanded", "true");
			menuClose.focus();
		};

		const closeMenu = () => {
			menuPanel.setAttribute("hidden", "");
			menuBackdrop.setAttribute("hidden", "");
			menuToggle.setAttribute("aria-expanded", "false");
			menuToggle.focus();
		};

		menuToggle.addEventListener("click", () => {
			if (menuPanel.hasAttribute("hidden")) {
				openMenu();
			} else {
				closeMenu();
			}
		});

		menuClose.addEventListener("click", () => {
			closeMenu();
		});

		menuBackdrop.addEventListener("click", () => {
			closeMenu();
		});

		menuItemsEls.forEach((item) => {
			item.addEventListener("click", () => {
				const index = Number(item.dataset.sceneIndex ?? 0);
				controller.goTo(index);
				closeMenu();
			});
		});

		document.addEventListener(
			"keydown",
			(e) => {
				if (e.key === "Escape" && !menuPanel.hasAttribute("hidden")) {
					e.preventDefault();
					closeMenu();
				}
			},
			true,
		);

		dots.forEach((dot) => {
			dot.addEventListener("click", () => {
				const index = Number(dot.dataset.sceneIndex ?? 0);
				controller.goTo(index);
			});
		});

		window.addEventListener("beforeunload", () => {
			controller.destroy();
		});
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

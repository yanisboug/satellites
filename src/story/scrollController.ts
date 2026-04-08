interface ScrollControllerOptions {
	layers: HTMLElement[];
	onSceneChange?: (index: number) => void;
}

interface SceneStyle {
	opacity: number;
	tz: number;
	scale: number;
	blur: number;
	zIndex: number;
}

const ACTIVE_STYLE: SceneStyle = {
	opacity: 1,
	tz: 0,
	scale: 1,
	blur: 0,
	zIndex: 2,
};

const FUTURE_STYLE: SceneStyle = {
	opacity: 0,
	tz: -220,
	scale: 0.84,
	blur: 12,
	zIndex: 0,
};

const PAST_STYLE: SceneStyle = {
	opacity: 0,
	tz: 120,
	scale: 1.08,
	blur: 10,
	zIndex: 1,
};

const WHEEL_STEP_LOCK_MS = 320;

function applyLayerStyle(
	layer: HTMLElement,
	style: SceneStyle,
	interactive: boolean,
) {
	layer.style.opacity = String(style.opacity);
	layer.style.transform = `translate3d(0, 0, ${style.tz}px) scale(${style.scale})`;
	layer.style.filter = `blur(${style.blur}px)`;
	layer.style.zIndex = String(style.zIndex);
	layer.style.pointerEvents = interactive ? "auto" : "none";
}

function isMenuOpen() {
	const panel = document.getElementById("nav-menu-panel");
	return Boolean(panel && !panel.hasAttribute("hidden"));
}

export function createScrollController({
	layers,
	onSceneChange,
}: ScrollControllerOptions) {
	const sceneCount = layers.length;
	let currentIndex = 0;
	let wheelUnlockTimer: ReturnType<typeof setTimeout> | null = null;

	const clampIndex = (index: number) =>
		Math.max(0, Math.min(sceneCount - 1, index));

	const render = () => {
		layers.forEach((layer, index) => {
			if (index === currentIndex) {
				applyLayerStyle(layer, ACTIVE_STYLE, true);
				return;
			}

			applyLayerStyle(
				layer,
				index < currentIndex ? PAST_STYLE : FUTURE_STYLE,
				false,
			);
		});

		onSceneChange?.(currentIndex);
	};

	const goTo = (index: number) => {
		if (sceneCount === 0) {
			return;
		}

		const nextIndex = clampIndex(index);
		if (nextIndex === currentIndex) {
			return;
		}

		currentIndex = nextIndex;
		render();
	};

	const step = (delta: number) => {
		goTo(currentIndex + delta);
	};

	const onWheel = (event: WheelEvent) => {
		if (isMenuOpen()) {
			return;
		}

		event.preventDefault();

		if (wheelUnlockTimer !== null) {
			return;
		}

		let delta = event.deltaY;
		if (event.deltaMode === 1) {
			delta *= 16;
		} else if (event.deltaMode === 2) {
			delta *= window.innerHeight;
		}

		if (delta === 0) {
			return;
		}

		step(delta > 0 ? 1 : -1);
		wheelUnlockTimer = setTimeout(() => {
			wheelUnlockTimer = null;
		}, WHEEL_STEP_LOCK_MS);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (isMenuOpen()) {
			return;
		}

		switch (event.key) {
			case "ArrowDown":
			case "ArrowRight":
			case "PageDown":
				event.preventDefault();
				step(1);
				break;
			case "ArrowUp":
			case "ArrowLeft":
			case "PageUp":
				event.preventDefault();
				step(-1);
				break;
			case " ":
				if (!(event.target instanceof HTMLButtonElement)) {
					event.preventDefault();
					step(1);
				}
				break;
			case "Home":
				event.preventDefault();
				goTo(0);
				break;
			case "End":
				event.preventDefault();
				goTo(sceneCount - 1);
				break;
		}
	};

	window.addEventListener("wheel", onWheel, { passive: false });
	window.addEventListener("keydown", onKeyDown);

	render();

	return { goTo };
}

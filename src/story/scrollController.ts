interface ScrollControllerOptions {
	sceneCount: number;
	layers: HTMLElement[];
	onSceneChange?: (index: number) => void;
}

interface StyleSample {
	opacity: number;
	tz: number;
	scale: number;
	blur: number;
	zIndex: number;
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function mixStyles(from: StyleSample, to: StyleSample, t: number): StyleSample {
	return {
		opacity: lerp(from.opacity, to.opacity, t),
		tz: lerp(from.tz, to.tz, t),
		scale: lerp(from.scale, to.scale, t),
		blur: lerp(from.blur, to.blur, t),
		zIndex: t < 0.5 ? from.zIndex : to.zIndex,
	};
}

function applyLayerStyle(
	layer: HTMLElement,
	s: StyleSample,
	pointerEventsAuto: boolean,
) {
	layer.style.transition = "none";
	layer.style.opacity = String(s.opacity);
	layer.style.transform = `translate3d(0, 0, ${s.tz}px) scale(${s.scale})`;
	layer.style.filter = `blur(${s.blur}px)`;
	layer.style.zIndex = String(s.zIndex);
	layer.style.pointerEvents = pointerEventsAuto ? "auto" : "none";
}

function pickInteractionLayer(styles: StyleSample[]) {
	let winner = 0;
	let bestOpacity = -1;
	let bestZ = -1;
	for (let idx = 0; idx < styles.length; idx++) {
		const s = styles[idx];
		if (s.opacity > bestOpacity + 0.001) {
			bestOpacity = s.opacity;
			bestZ = s.zIndex;
			winner = idx;
		} else if (
			Math.abs(s.opacity - bestOpacity) <= 0.001 &&
			s.zIndex >= bestZ
		) {
			bestZ = s.zIndex;
			winner = idx;
		}
	}
	return winner;
}

export function createScrollController({
	sceneCount,
	layers,
	onSceneChange,
}: ScrollControllerOptions) {
	let progress = 0;
	let lastReportedIndex = -1;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let snapRaf = 0;
	let wheelUnlockTimer: ReturnType<typeof setTimeout> | null = null;

	const IDLE_SNAP_MS = 140;
	const SNAP_DURATION_MS = 420;
	const WHEEL_STEP_LOCK_MS = 320;

	let metricsCache = getDepthMetrics();

	function getDepthMetrics() {
		const narrow = window.matchMedia("(max-width: 600px)").matches;
		return {
			active: {
				opacity: 1,
				tz: 0,
				scale: 1,
				blur: 0,
				zIndex: 2,
			} satisfies StyleSample,
			future: {
				opacity: 0,
				tz: narrow ? -140 : -220,
				scale: narrow ? 0.88 : 0.84,
				blur: 12,
				zIndex: 0,
			} satisfies StyleSample,
			past: {
				opacity: 0,
				tz: narrow ? 80 : 120,
				scale: narrow ? 1.04 : 1.08,
				blur: 10,
				zIndex: 1,
			} satisfies StyleSample,
		};
	}

	const clampProgress = (p: number) => Math.max(0, Math.min(sceneCount - 1, p));

	const isNavMenuOpen = () => {
		const panel = document.getElementById("nav-menu-panel");
		return Boolean(panel && !panel.hasAttribute("hidden"));
	};

	const reportSceneIfNeeded = () => {
		const idx = Math.round(clampProgress(progress));
		if (idx !== lastReportedIndex) {
			lastReportedIndex = idx;
			onSceneChange?.(idx);
		}
	};

	const applyContinuousProgress = () => {
		const { active, future, past } = metricsCache;
		const p = clampProgress(progress);
		const n = sceneCount;

		if (n === 0) {
			return;
		}

		if (n === 1) {
			applyLayerStyle(layers[0], active, true);
			reportSceneIfNeeded();
			return;
		}

		const i = Math.min(Math.floor(p), n - 1);
		const t = p - i;
		const styles: StyleSample[] = [];

		if (i >= n - 1) {
			for (let idx = 0; idx < n; idx++) {
				styles.push(idx < n - 1 ? past : active);
			}
		} else {
			for (let idx = 0; idx < n; idx++) {
				if (idx < i) {
					styles.push(past);
				} else if (idx > i + 1) {
					styles.push(future);
				} else if (idx === i) {
					styles.push(mixStyles(active, past, t));
				} else {
					styles.push(mixStyles(future, active, t));
				}
			}
		}

		const interactionIndex = pickInteractionLayer(styles);
		layers.forEach((layer, idx) => {
			const s = styles[idx];
			if (!s) {
				return;
			}
			applyLayerStyle(layer, s, idx === interactionIndex && s.opacity > 0.04);
		});

		reportSceneIfNeeded();
	};

	const cancelIdleSnap = () => {
		if (idleTimer !== null) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	};

	const cancelSnapAnimation = () => {
		if (snapRaf !== 0) {
			cancelAnimationFrame(snapRaf);
			snapRaf = 0;
		}
	};

	const releaseWheelLock = () => {
		if (wheelUnlockTimer !== null) {
			clearTimeout(wheelUnlockTimer);
			wheelUnlockTimer = null;
		}
	};

	const scheduleIdleSnap = () => {
		cancelIdleSnap();
		idleTimer = setTimeout(() => {
			idleTimer = null;
			const target = Math.round(clampProgress(progress));
			startSnapTo(target);
		}, IDLE_SNAP_MS);
	};

	const startSnapTo = (targetIndex: number) => {
		const target = clampProgress(targetIndex);
		cancelIdleSnap();
		cancelSnapAnimation();

		const start = progress;
		if (Math.abs(start - target) < 0.0001) {
			progress = target;
			applyContinuousProgress();
			return;
		}

		const t0 = performance.now();

		const frame = (now: number) => {
			const u = Math.min(1, (now - t0) / SNAP_DURATION_MS);
			const eased = 1 - (1 - u) ** 3;
			progress = start + (target - start) * eased;
			applyContinuousProgress();
			if (u < 1) {
				snapRaf = requestAnimationFrame(frame);
			} else {
				progress = target;
				applyContinuousProgress();
				snapRaf = 0;
			}
		};

		snapRaf = requestAnimationFrame(frame);
	};

	const discreteStep = (delta: number) => {
		cancelIdleSnap();
		cancelSnapAnimation();
		const cur = Math.round(clampProgress(progress));
		startSnapTo(cur + delta);
	};

	const onWheel = (e: WheelEvent) => {
		if (isNavMenuOpen()) {
			return;
		}
		e.preventDefault();

		if (wheelUnlockTimer !== null) {
			return;
		}

		let delta = e.deltaY;
		if (e.deltaMode === 1) {
			delta *= 16;
		}
		if (e.deltaMode === 2) {
			delta *= window.innerHeight;
		}

		if (delta === 0) {
			return;
		}

		discreteStep(delta > 0 ? 1 : -1);
		wheelUnlockTimer = setTimeout(() => {
			wheelUnlockTimer = null;
		}, WHEEL_STEP_LOCK_MS);
	};

	const onKeyDown = (e: KeyboardEvent) => {
		if (isNavMenuOpen()) {
			return;
		}
		const target = e.target as HTMLElement;
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
			return;
		}

		switch (e.key) {
			case "ArrowDown":
			case "ArrowRight":
			case "PageDown":
				e.preventDefault();
				discreteStep(1);
				break;
			case "ArrowUp":
			case "ArrowLeft":
			case "PageUp":
				e.preventDefault();
				discreteStep(-1);
				break;
			case " ":
				if (target.tagName !== "BUTTON") {
					e.preventDefault();
					discreteStep(1);
				}
				break;
			case "Home":
				e.preventDefault();
				startSnapTo(0);
				break;
			case "End":
				e.preventDefault();
				startSnapTo(sceneCount - 1);
				break;
		}
	};

	let touchLastY = 0;
	let touchTracking = false;

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length !== 1) {
			return;
		}
		touchLastY = e.touches[0].clientY;
		touchTracking = true;
	};

	const TOUCH_SENSITIVITY = 0.0065;

	const onTouchMove = (e: TouchEvent) => {
		if (!touchTracking || isNavMenuOpen() || e.touches.length !== 1) {
			return;
		}
		const y = e.touches[0].clientY;
		const dy = touchLastY - y;
		touchLastY = y;

		cancelSnapAnimation();
		progress = clampProgress(progress + dy * TOUCH_SENSITIVITY);
		applyContinuousProgress();
		scheduleIdleSnap();
	};

	const onTouchEnd = () => {
		touchTracking = false;
	};

	const onResize = () => {
		metricsCache = getDepthMetrics();
		applyContinuousProgress();
	};

	window.addEventListener("wheel", onWheel, { passive: false });
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("touchstart", onTouchStart, { passive: true });
	window.addEventListener("touchmove", onTouchMove, { passive: true });
	window.addEventListener("touchend", onTouchEnd);
	window.addEventListener("resize", onResize);

	progress = 0;
	lastReportedIndex = -1;
	applyContinuousProgress();

	return {
		get activeIndex() {
			return Math.round(clampProgress(progress));
		},
		goTo(index: number) {
			cancelIdleSnap();
			startSnapTo(index);
		},
		destroy() {
			cancelIdleSnap();
			cancelSnapAnimation();
			releaseWheelLock();
			window.removeEventListener("wheel", onWheel);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("resize", onResize);
		},
	};
}

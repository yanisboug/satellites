type TooltipPlacement = "left" | "right";

interface TooltipOptions {
	placement?: TooltipPlacement;
}

export interface TooltipController {
	show(
		content: string,
		event: PointerEvent | MouseEvent,
		options?: TooltipOptions,
	): void;
	move(event: PointerEvent | MouseEvent, options?: TooltipOptions): void;
	hide(): void;
}

export function createTooltip(container: HTMLElement): TooltipController {
	const tooltip = document.createElement("div");
	tooltip.className = "viz-tooltip";
	container.append(tooltip);
	let lastPlacement: TooltipPlacement = "right";

	const setPosition = (
		event: PointerEvent | MouseEvent,
		options?: TooltipOptions,
	) => {
		const placement = options?.placement ?? lastPlacement;
		const offset = 16;
		const maxLeft = window.innerWidth - tooltip.offsetWidth - 12;
		const maxTop = window.innerHeight - tooltip.offsetHeight - 12;
		const preferredLeft =
			placement === "left"
				? event.clientX - tooltip.offsetWidth - offset
				: event.clientX + offset;
		const preferredTop = event.clientY + offset;
		const left = Math.min(Math.max(12, preferredLeft), Math.max(12, maxLeft));
		const top = Math.min(Math.max(12, preferredTop), Math.max(12, maxTop));

		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	};

	return {
		show(content, event, options) {
			tooltip.innerHTML = content;
			tooltip.dataset.visible = "true";
			lastPlacement = options?.placement ?? "right";
			setPosition(event, options);
		},
		move(event, options) {
			setPosition(event, options);
		},
		hide() {
			tooltip.dataset.visible = "false";
		},
	};
}

type TooltipPlacement = "left" | "right";

interface TooltipOptions {
	placement?: TooltipPlacement;
}

export interface TooltipController {
	id: string;
	show(
		content: string,
		event: PointerEvent | MouseEvent,
		options?: TooltipOptions,
	): void;
	move(event: PointerEvent | MouseEvent, options?: TooltipOptions): void;
	hide(): void;
}

let instanceCounter = 0;

export function createTooltip(container: HTMLElement): TooltipController {
	instanceCounter += 1;
	const tooltip = document.createElement("div");
	const id = `viz-tooltip-${instanceCounter}`;
	tooltip.className = "viz-tooltip";
	tooltip.id = id;
	tooltip.setAttribute("role", "tooltip");
	tooltip.setAttribute("aria-live", "polite");
	tooltip.setAttribute("aria-atomic", "true");
	tooltip.dataset.visible = "false";
	container.append(tooltip);
	let lastPlacement: TooltipPlacement = "right";
	let tooltipWidth = 0;
	let tooltipHeight = 0;

	const setPosition = (
		event: PointerEvent | MouseEvent,
		options?: TooltipOptions,
	) => {
		const placement = options?.placement ?? lastPlacement;
		const offset = 16;
		const width = tooltipWidth || tooltip.offsetWidth;
		const height = tooltipHeight || tooltip.offsetHeight;
		const maxLeft = window.innerWidth - width - 12;
		const maxTop = window.innerHeight - height - 12;
		const preferredLeft =
			placement === "left"
				? event.clientX - width - offset
				: event.clientX + offset;
		const preferredBelow = event.clientY + offset;
		const preferredAbove = event.clientY - height - offset;
		const preferredTop =
			preferredBelow + height <= window.innerHeight - 12
				? preferredBelow
				: preferredAbove;
		const left = Math.min(Math.max(12, preferredLeft), Math.max(12, maxLeft));
		const top = Math.min(Math.max(12, preferredTop), Math.max(12, maxTop));

		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	};

	return {
		id,
		show(content, event, options) {
			tooltip.innerHTML = content;
			tooltip.dataset.visible = "true";
			tooltipWidth = tooltip.offsetWidth;
			tooltipHeight = tooltip.offsetHeight;
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

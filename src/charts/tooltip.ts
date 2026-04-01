export interface TooltipController {
	show(content: string, event: PointerEvent | MouseEvent): void;
	move(event: PointerEvent | MouseEvent): void;
	hide(): void;
}

export function createTooltip(container: HTMLElement): TooltipController {
	const tooltip = document.createElement("div");
	tooltip.className = "viz-tooltip";
	container.append(tooltip);

	const setPosition = (event: PointerEvent | MouseEvent) => {
		tooltip.style.left = `${event.clientX + 16}px`;
		tooltip.style.top = `${event.clientY + 16}px`;
	};

	return {
		show(content, event) {
			tooltip.innerHTML = content;
			tooltip.dataset.visible = "true";
			setPosition(event);
		},
		move(event) {
			setPosition(event);
		},
		hide() {
			tooltip.dataset.visible = "false";
		},
	};
}

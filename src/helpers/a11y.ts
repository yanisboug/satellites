import type { BaseType, Selection } from "d3";

let idCounter = 0;
function uid(prefix: string) {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
}

interface FigureDescriptionOptions {
	svg: Selection<SVGSVGElement, unknown, null, undefined>;
	title: string;
	description: string;
	container?: HTMLElement;
}

export function appendFigureDescription({
	svg,
	title,
	description,
	container,
}: FigureDescriptionOptions) {
	const node = svg.node();
	if (!node) {
		return { titleId: "", descId: "" };
	}

	const target =
		container ??
		(node.parentElement instanceof HTMLElement ? node.parentElement : null);
	if (!target) {
		svg.attr("role", "img").attr("aria-label", `${title}. ${description}`);
		return { titleId: "", descId: "" };
	}

	const titleId = uid("chart-title");
	const descId = uid("chart-desc");

	const wrapper = document.createElement("div");
	wrapper.className = "visually-hidden";

	const titleEl = document.createElement("p");
	titleEl.id = titleId;
	titleEl.textContent = title;

	const descEl = document.createElement("p");
	descEl.id = descId;
	descEl.textContent = description;

	wrapper.append(titleEl, descEl);
	target.insertBefore(wrapper, node);

	svg
		.attr("role", "img")
		.attr("aria-labelledby", titleId)
		.attr("aria-describedby", descId)
		.attr("aria-label", null);

	return { titleId, descId };
}

interface DataTableColumn<T> {
	header: string;
	accessor: (row: T) => string | number;
	scope?: "col" | "row";
}

interface DataTableOptions<T> {
	container: HTMLElement;
	caption: string;
	summary?: string;
	columns: DataTableColumn<T>[];
	rows: T[];
}

export function appendDataTable<T>({
	container,
	caption,
	summary,
	columns,
	rows,
}: DataTableOptions<T>) {
	const wrapper = document.createElement("div");
	wrapper.className = "visually-hidden";

	const table = document.createElement("table");
	table.className = "chart-data-table";

	const captionEl = document.createElement("caption");
	captionEl.textContent = caption;
	table.appendChild(captionEl);

	if (summary) {
		const summaryEl = document.createElement("p");
		summaryEl.textContent = summary;
		wrapper.appendChild(summaryEl);
	}

	const thead = document.createElement("thead");
	const headRow = document.createElement("tr");
	for (const column of columns) {
		const th = document.createElement("th");
		th.scope = "col";
		th.textContent = column.header;
		headRow.appendChild(th);
	}
	thead.appendChild(headRow);
	table.appendChild(thead);

	const tbody = document.createElement("tbody");
	for (const row of rows) {
		const tr = document.createElement("tr");
		columns.forEach((column, index) => {
			const cell = document.createElement(
				index === 0 && column.scope !== "col" ? "th" : "td",
			);
			if (cell instanceof HTMLTableCellElement && cell.tagName === "TH") {
				cell.scope = "row";
			}
			cell.textContent = String(column.accessor(row));
			tr.appendChild(cell);
		});
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);

	wrapper.appendChild(table);
	container.appendChild(wrapper);

	return { wrapper, table };
}

function focusEventFromElement(element: Element): MouseEvent {
	const rect = element.getBoundingClientRect();
	return new MouseEvent("focus", {
		clientX: rect.left + rect.width / 2,
		clientY: rect.top + rect.height / 2,
	});
}

interface TooltipInteractionOptions<GElement extends Element, Datum> {
	show: (
		event: PointerEvent | MouseEvent,
		datum: Datum,
		element: GElement,
	) => void;
	move?: (event: PointerEvent) => void;
	hide: () => void;
}

export function bindTooltipInteractions<
	GElement extends Element,
	Datum,
	PElement extends BaseType,
	PDatum,
>(
	selection: Selection<GElement, Datum, PElement, PDatum>,
	{ show, move, hide }: TooltipInteractionOptions<GElement, Datum>,
) {
	return selection
		.on(
			"pointerenter",
			function handlePointerEnter(
				this: GElement,
				event: PointerEvent,
				datum: Datum,
			) {
				show(event, datum, this);
			},
		)
		.on("pointermove", (event: PointerEvent) => {
			move?.(event);
		})
		.on("pointerleave", hide)
		.on(
			"focus",
			function handleFocus(this: GElement, _event: FocusEvent, datum: Datum) {
				show(focusEventFromElement(this), datum, this);
			},
		)
		.on("blur", hide)
		.on(
			"keydown",
			function handleKeydown(
				this: GElement,
				event: KeyboardEvent,
				datum: Datum,
			) {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					show(focusEventFromElement(this), datum, this);
				}
			},
		);
}

import type { Selection } from "d3";

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

interface InteractiveOptions<Datum> {
	role?: "button" | "gridcell" | "img";
	label: (datum: Datum) => string;
	onActivate?: (datum: Datum, event: KeyboardEvent | MouseEvent) => void;
}

export function makeInteractive<
	GElement extends Element,
	Datum,
	PElement extends Element,
	PDatum,
>(
	selection: Selection<GElement, Datum, PElement, PDatum>,
	options: InteractiveOptions<Datum>,
) {
	selection
		.attr("tabindex", 0)
		.attr("role", options.role ?? "button")
		.attr("aria-label", (datum) => options.label(datum));

	if (options.onActivate) {
		const onActivate = options.onActivate;
		selection.on("keydown", (event: KeyboardEvent, datum: Datum) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onActivate(datum, event);
			}
		});
	}

	return selection;
}

export function focusEventFromElement(element: Element): MouseEvent {
	const rect = element.getBoundingClientRect();
	return new MouseEvent("focus", {
		clientX: rect.left + rect.width / 2,
		clientY: rect.top + rect.height / 2,
	});
}

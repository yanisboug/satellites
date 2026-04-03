interface TooltipRow {
	label: string;
	value: string;
}

interface TooltipSection {
	label: string;
	rows: TooltipRow[];
}

interface TooltipContentOptions {
	rows?: TooltipRow[];
	sections?: TooltipSection[];
	subtitle?: string;
	title: string;
}

export function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderRows(rows: TooltipRow[]) {
	if (rows.length === 0) {
		return "";
	}

	return `
		<div class="chart-tooltip-rows">
			${rows
				.map(
					(row) => `
						<div class="chart-tooltip-row">
							<span class="chart-tooltip-label">${escapeHtml(row.label)}</span>
							<span class="chart-tooltip-value">${escapeHtml(row.value)}</span>
						</div>
					`,
				)
				.join("")}
		</div>
	`;
}

export function buildTooltip({
	rows = [],
	sections = [],
	subtitle,
	title,
}: TooltipContentOptions) {
	return `
		<div class="chart-tooltip">
			<div class="chart-tooltip-title">${escapeHtml(title)}</div>
			${subtitle ? `<div class="chart-tooltip-subtitle">${escapeHtml(subtitle)}</div>` : ""}
			${renderRows(rows)}
			${sections
				.map(
					(section) => `
						<div class="chart-tooltip-section">
							<div class="chart-tooltip-section-title">${escapeHtml(section.label)}</div>
							${renderRows(section.rows)}
						</div>
					`,
				)
				.join("")}
		</div>
	`;
}

import {
	BooleanNumber,
	CellValueType,
	LocaleType,
	TextDecoration,
	type ICellData,
	type IRange,
	type ITextRun,
	type IWorkbookData,
	type IWorksheetData,
} from '@univerjs/core';
import { BlobReader, ZipReader, TextWriter } from '@zip.js/zip.js';

const relationship_ns =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

export async function parse_xlsx(data: Blob) {
	const reader = new ZipReader(new BlobReader(data));

	const entries = Object.fromEntries(
		(await reader.getEntries()).map((e) => [e.filename, e]),
	);

	const parser = new DOMParser();

	async function read_xml_file(
		name: string,
		read_rels?: true,
	): Promise<{
		doc: Document;
		rels: Record<string, { type: string; target: string }> | null;
	}>;
	async function read_xml_file(
		name: string,
		read_rels?: false,
	): Promise<Document>;
	async function read_xml_file(name: string, should_read_rels: boolean = true) {
		const file = entries[name];
		if (!file || file.directory) {
			throw new Error(name + ' not found');
		}
		const text = await file.getData(new TextWriter());
		const doc = parser.parseFromString(text, 'text/xml');
		if (!should_read_rels) return doc;

		// console.log(text);
		const last_slash = name.lastIndexOf('/');
		const rel_name =
			`${name.substring(0, last_slash)}/_rels/${name.substring(last_slash + 1)}.rels` as const;
		return {
			doc: parser.parseFromString(text, 'text/xml'),
			rels: rel_name ? await read_rels(rel_name) : null,
		};
	}
	async function read_rels(name: `${string}.rels`) {
		const doc = await read_xml_file(name, false);
		const relationships: Record<string, { type: string; target: string }> = {};
		doc.querySelectorAll('Relationship').forEach((rel) => {
			relationships[rel.getAttribute('Id')!] = {
				type: rel.getAttribute('Type')!,
				target: rel.getAttribute('Target')!,
			};
		});
		return relationships;
	}

	const root = await read_rels('_rels/.rels');
	const workbook_path = Object.values(root).find(
		(rel) => rel.type === `${relationship_ns}officeDocument`,
	)?.target;
	if (!workbook_path) {
		throw new Error('no officeDocument found');
	}
	const workbook = await read_xml_file(workbook_path);
	if (!workbook.rels) {
		throw new Error('expected workbook to have rels');
	}
	const sheet_root = dirname(workbook_path) + '/';

	const shared_strings_path = Object.values(workbook.rels).find(
		(rel) => rel.type === `${relationship_ns}sharedStrings`,
	)?.target;
	if (!shared_strings_path) {
		throw new Error('no sharedStrings found');
	}
	const shared_strings = [
		...(
			await read_xml_file(sheet_root + shared_strings_path, false)
		).querySelectorAll('si'),
	].map((si) => parse_rich_text(si));

	const sheet_meta = [...workbook.doc.querySelectorAll('sheet')].map(
		(sheet) => ({
			name: sheet.getAttribute('name')!,
			id: sheet.getAttribute('sheetId')!,
			state: sheet.getAttribute('state')!,
			rel_id: sheet.getAttribute('r:id')!,
		}),
	);
	const sheets: Record<
		string,
		Omit<IWorksheetData, 'scrollTop' | 'scrollLeft' | 'zoomRatio'>
	> = {};
	for (const meta of sheet_meta) {
		const rel = workbook.rels[meta.rel_id];
		if (!rel) throw new Error('no rel found for sheet ' + meta.name);
		const sheet = await read_xml_file(sheet_root + rel.target);

		const freeze_pane = sheet.doc.querySelector('sheetViews>sheetView>pane');
		const freeze: IWorksheetData['freeze'] = {
			xSplit: 0,
			ySplit: 0,
			startRow: -1,
			startColumn: -1,
		};
		if (freeze_pane) {
			const x_split = Number(freeze_pane.getAttribute('xSplit'));
			if (!Number.isNaN(x_split)) {
				freeze.xSplit = x_split + 1;
				freeze.startColumn = x_split;
			}
			const y_split = Number(freeze_pane.getAttribute('ySplit'));
			if (!Number.isNaN(y_split)) {
				freeze.ySplit = y_split + 1;
				freeze.startRow = y_split;
			}
		}

		let tab_color = sheet.doc
			.querySelector('sheetPr > tabColor')
			?.getAttribute('rgb');
		if (tab_color) {
			tab_color = argb_to_rgb(tab_color);
		}
		const sheet_format_pr = sheet.doc.querySelector('sheetFormatPr');
		const default_column_width =
			sheet_format_pr?.getAttribute('defaultColWidth');
		const default_row_height =
			sheet_format_pr?.getAttribute('defaultRowHeight');

		const cell_data: Record<number, Record<number, ICellData>> = {};
		for (const row of sheet.doc.querySelectorAll('sheetData>row')) {
			const row_index = Number(row.getAttribute('r')!) - 1;
			cell_data[row_index as number /* weird typescript bug? */] = {};
			const row_cells = cell_data[row_index]!;
			for (const cell of row.querySelectorAll('c')) {
				const cell_index = (column_letter_to_number(
					cell.getAttribute('r')!.match(/^[A-Z]+/)![0],
				) - 1) as number;
				// b: boolean, d: date, e: error, inlineStr: string, n: number, s: shared string
				const cell_type = cell.getAttribute('t') ?? 'n';
				const style_index = cell.getAttribute('s');
				const value = cell.querySelector('v')?.textContent;
				let formula = cell.querySelector('f')?.textContent;
				if (formula) formula = `=${formula}`;
				switch (cell_type) {
					case 'n':
						row_cells[cell_index] = {
							t: CellValueType.NUMBER,
							v: Number(value),
							f: formula,
						};
						break;
					case 'b':
						row_cells[cell_index] = {
							t: CellValueType.BOOLEAN,
							v: bn(value === '1'),
							f: formula,
						};
						break;
					case 'str':
						row_cells[cell_index] = {
							t: CellValueType.STRING,
							v: value,
							f: formula,
						};
						break;
					case 's': {
						const shared_string = shared_strings[Number(value)] ?? '';
						if (typeof shared_string === 'string') {
							row_cells[cell_index] = {
								t: CellValueType.STRING,
								v: shared_string,
							};
						} else {
							row_cells[cell_index] = {
								p: {
									id: '__INTERNAL_EDITOR__DOCS_NORMAL',
									documentStyle: {},
									body: shared_string,
								},
							};
						}
						break;
					}
				}
			}
		}

		sheets[meta.id] = {
			id: meta.id,
			name: meta.name,
			tabColor: tab_color ?? '',
			hidden: bn(meta.state !== 'visible'),
			showGridlines: bn(
				sheet.doc
					.querySelector('sheetViews>sheetView')
					?.getAttribute('showGridLines') !== '0',
			),
			freeze,
			defaultColumnWidth: default_column_width
				? Math.round(Number(default_column_width) * 6.96753760886777 * 100) /
					100 // ch to px
				: undefined!,
			defaultRowHeight: default_row_height
				? Math.round(Number(default_row_height) * 1.52380952380952 * 100) / 100 // pt to px
				: undefined!,
			mergeData: [...sheet.doc.querySelectorAll('mergeCells>mergeCell')].map(
				(merge) => parse_range(merge.getAttribute('ref')!),
			),
			cellData: cell_data,
		};
	}

	const new_sheet: Omit<IWorkbookData, 'id' | 'appVersion'> = {
		name: 'TODO',
		locale: LocaleType.EN_US,
		styles: {},
		sheetOrder: sheet_meta.map((sheet) => sheet.id),
		sheets,
	};
	return new_sheet;
}

function dirname(path: string) {
	return path.substring(0, path.lastIndexOf('/'));
}

function parse_range(range: string): IRange {
	const match = range.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
	if (!match) throw new Error('invalid range: ' + range);

	const start_column = column_letter_to_number(match[1]!) - 1;
	const start_row = Number(match[2]) - 1;
	if (match[3] !== undefined && match[4] !== undefined) {
		return {
			startColumn: start_column,
			startRow: start_row,
			endColumn: column_letter_to_number(match[3]) - 1,
			endRow: Number(match[4]) - 1,
		};
	}
	return {
		startColumn: start_column,
		startRow: start_row,
		endColumn: start_column,
		endRow: start_row,
	};
}

// e.g. A -> 1, Z -> 26, AA -> 27, etc.
function column_letter_to_number(column: string) {
	const column_letter = column.toUpperCase();
	let column_number = 0;
	for (let i = 0; i < column_letter.length; i++) {
		column_number += Math.pow(26, i) * (column_letter.charCodeAt(i) - 64);
	}
	return column_number;
}

function bn(bool: boolean) {
	return bool ? BooleanNumber.TRUE : BooleanNumber.FALSE;
}

function parse_rich_text(element: Element) {
	if (element.childElementCount === 1) {
		const t = element.querySelector('t');
		if (t) {
			return t.textContent;
		}
	}
	const runs = element.querySelectorAll('r');
	const text_runs: ITextRun[] = [];
	let text = '';
	for (const run of runs) {
		const text_el = run.querySelector('t');
		if (!text_el) continue;
		let part_text = text_el.textContent;
		if (text_el.getAttribute('xml:space') !== 'preserve') {
			part_text = part_text.trim();
		}
		const rich: Record<string, Record<string, string>> = {};
		for (const el of run.querySelector('rPr')?.children ?? []) {
			rich[el.tagName] = Object.fromEntries(
				el.getAttributeNames().map((attr) => [attr, el.getAttribute(attr)!]),
			);
		}
		console.log(run.outerHTML, rich);
		text_runs.push({
			st: text.length,
			ed: text.length + part_text.length,
			ts: {
				bl: bn(!!rich.b),
				it: bn(!!rich.i),
				fs: rich.sz?.val ? Number(rich.sz.val) : undefined,
				ff: rich.rFont?.val,
				ul: rich.u
					? {
							s: bn(rich.u.val !== 'none'),
							t:
								{
									double: TextDecoration.DOUBLE,
									doubleAccounting: TextDecoration.DOUBLE,
									single: TextDecoration.SINGLE,
									singleAccounting: TextDecoration.SINGLE,
								}[rich.u.val!] ?? TextDecoration.SINGLE,
						}
					: undefined,
				st: rich.strike
					? {
							s: bn(true),
							t: TextDecoration.SINGLE,
						}
					: undefined,
				cl: rich.color?.rgb
					? {
							rgb: argb_to_rgb(rich.color.rgb),
						}
					: undefined,
			},
		});
		text += part_text;
	}
	return {
		dataStream: text + '\r\n',
		textRuns: text_runs,
	};
}

function argb_to_rgb(argb: string) {
	return `#${argb.substring(2)}${argb.substring(0, 2)}`;
}

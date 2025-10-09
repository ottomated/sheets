import {
	BooleanNumber,
	BorderStyleTypes,
	CellValueType,
	CustomRangeType,
	HorizontalAlign,
	LocaleType,
	TextDecoration,
	TextDirection,
	VerticalAlign,
	WrapStrategy,
	type IBorderData,
	type IBorderStyleData,
	type ICellData,
	type IColumnData,
	type IDocumentBody,
	type IRange,
	type IRowData,
	type IStyleData,
	type ITextRun,
	type IWorkbookData,
	type IWorksheetData,
} from '@univerjs/core';
import { BlobReader, ZipReader, TextWriter } from '@zip.js/zip.js';
import { nanoid } from 'nanoid';

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
		rels: Record<
			string,
			{ type: string; target: string; target_mode: string | null }
		> | null;
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
		const relationships: Record<
			string,
			{ type: string; target: string; target_mode: string | null }
		> = {};
		doc.querySelectorAll('Relationship').forEach((rel) => {
			relationships[rel.getAttribute('Id')!] = {
				type: rel.getAttribute('Type')!,
				target: rel.getAttribute('Target')!,
				target_mode: rel.getAttribute('TargetMode'),
			};
		});
		return relationships;
	}

	const root_rels = await read_rels('_rels/.rels');
	const workbook_path = Object.values(root_rels).find(
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
	const styles_path = Object.values(workbook.rels).find(
		(rel) => rel.type === `${relationship_ns}styles`,
	)?.target;
	if (!styles_path) {
		throw new Error('no styles found');
	}
	const styles = parse_styles(
		await read_xml_file(sheet_root + styles_path, false),
	);

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
		Omit<
			IWorksheetData,
			| 'scrollTop'
			| 'scrollLeft'
			| 'zoomRatio'
			| 'rowCount'
			| 'columnCount'
			| 'rowHeader'
			| 'columnHeader'
		>
	> = {};
	for (const meta of sheet_meta) {
		const rel = workbook.rels[meta.rel_id];
		if (!rel) throw new Error('no rel found for sheet ' + meta.name);
		const sheet = await read_xml_file(sheet_root + rel.target);

		const hyperlinks: Record<string, string | undefined> = Object.fromEntries(
			[...sheet.doc.querySelectorAll('hyperlinks>hyperlink')].map((link) => {
				const ref = link.getAttribute('ref')!;
				const location = link.getAttribute('location');
				if (location) {
					const [sheet_name, range] = location.split('!');
					const sheet = sheet_meta.find((s) => s.name === sheet_name);
					if (!sheet) return [ref];

					return [ref, `#gid=${sheet.id}&range=${range}`];
				}
				const rel_id = link.getAttribute('r:id');
				if (!rel_id) return [ref];
				return [ref, sheet.rels?.[rel_id]?.target];
			}),
		);

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

		const column_data: Record<number, IColumnData> = {};
		for (const col of sheet.doc.querySelectorAll('cols>col')) {
			const min = Number(col.getAttribute('min')!) - 1;
			const max = Number(col.getAttribute('max')!) - 1;
			const data: IColumnData = {
				hd: bn(col.getAttribute('hidden') === '1'),
				w:
					col.getAttribute('customWidth') === '1' && col.hasAttribute('width')
						? col_ch_to_px(Number(col.getAttribute('width')!))
						: undefined,
			};
			for (let i = min; i <= max; i++) {
				column_data[i] = data;
			}
		}

		const row_data: Record<number, IRowData> = {};
		const cell_data: Record<number, Record<number, ICellData>> = {};
		for (const row of sheet.doc.querySelectorAll('sheetData>row')) {
			const row_index = Number(row.getAttribute('r')!) - 1;
			if (row.getAttribute('customHeight') === '1') {
				row_data[row_index as number] ??= {};
				row_data[row_index as number]!.h = row_pt_to_px(
					Number(row.getAttribute('ht')!),
				);
			}
			if (row.getAttribute('hidden') === '1') {
				row_data[row_index as number] ??= {};
				row_data[row_index as number]!.hd = bn(true);
			}

			cell_data[row_index as number /* weird typescript bug? */] = {};
			const row_cells = cell_data[row_index]!;
			for (const cell of row.querySelectorAll('c')) {
				const rel = cell.getAttribute('r')!;
				const cell_index = (column_letter_to_number(rel.match(/^[A-Z]+/)![0]) -
					1) as number;
				const cell_type = cell.getAttribute('t') ?? 'n';
				const style_index = cell.getAttribute('s') ?? undefined;
				const value = cell.querySelector('v')?.textContent;
				let formula = cell.querySelector('f')?.textContent;
				if (formula) formula = `=${formula}`;
				const hyperlink =
					value !== undefined && !formula ? hyperlinks[rel] : undefined;
				function get_cell(): ICellData | undefined {
					switch (cell_type) {
						case 'n':
							if (hyperlink)
								return generate_url(value!, hyperlink, style_index);
							return {
								t: CellValueType.NUMBER,
								v: Number(value),
								f: formula,
								s: style_index,
							};
						case 'b':
							if (hyperlink)
								return generate_url(
									value === '1' ? 'TRUE' : 'FALSE',
									hyperlink,
									style_index,
								);
							return {
								t: CellValueType.BOOLEAN,
								v: bn(value === '1'),
								f: formula,
								s: style_index,
							};
						case 'str':
							if (hyperlink)
								return generate_url(value!, hyperlink, style_index);

							return {
								t: CellValueType.STRING,
								v: value,
								f: formula,
								s: style_index,
							};
						case 's': {
							const shared_string = shared_strings[Number(value)] ?? '';
							if (typeof shared_string === 'string') {
								if (hyperlink)
									return generate_url(shared_string, hyperlink, style_index);
								return {
									t: CellValueType.STRING,
									v: shared_string,
									s: style_index,
								};
							} else {
								const body = shared_string;
								if (hyperlink) {
									body.customRanges = [
										{
											rangeId: nanoid(),
											rangeType: CustomRangeType.HYPERLINK,
											startIndex: 0,
											endIndex: body.dataStream.length,
											properties: {
												url: hyperlink,
											},
										},
									];
								}
								return {
									p: {
										id: '__INTERNAL_EDITOR__DOCS_NORMAL',
										documentStyle: {},
										body,
									},
									s: style_index,
								};
							}
						}
					}
				}
				const res = get_cell();
				if (res) row_cells[cell_index] = res;
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
				? col_ch_to_px(Number(default_column_width))
				: undefined!,
			defaultRowHeight: default_row_height
				? row_pt_to_px(Number(default_row_height))
				: undefined!,
			mergeData: [...sheet.doc.querySelectorAll('mergeCells>mergeCell')].map(
				(merge) => parse_range(merge.getAttribute('ref')!),
			),
			cellData: cell_data,
			rightToLeft: bn(false),
			columnData: column_data,
			rowData: row_data,
		};
	}

	const new_sheet: Omit<IWorkbookData, 'id' | 'appVersion'> = {
		name: 'TODO',
		locale: LocaleType.EN_US,
		styles,
		sheetOrder: sheet_meta.map((sheet) => sheet.id),
		sheets,
	};
	return new_sheet;
}
function col_ch_to_px(ch: number) {
	return Math.round(ch * 6.96753760886777 * 100) / 100;
}
function row_pt_to_px(pt: number) {
	return Math.round(pt * 1.52380952380952 * 100) / 100;
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

function bn(bool: unknown) {
	return bool ? BooleanNumber.TRUE : BooleanNumber.FALSE;
}

function parse_rich_text(element: Element): IDocumentBody | string {
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
			rich[el.tagName] = get_attrs_object(el);
		}
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
function generate_url(
	text: string,
	url: string,
	style_index: string | undefined,
): ICellData {
	const id = nanoid();
	return {
		p: {
			id: '__INTERNAL_EDITOR__DOCS_NORMAL',
			documentStyle: {},
			body: {
				dataStream: text + '\r\n',
				customRanges: [
					{
						rangeId: id,
						rangeType: CustomRangeType.HYPERLINK,
						startIndex: 0,
						endIndex: text.length,
						properties: {
							url,
						},
					},
				],
			},
		},
		s: style_index,
	};
}

function argb_to_rgb(argb: string) {
	return `#${argb.substring(2)}${argb.substring(0, 2)}`;
}

function get_attrs_object(el: Element) {
	return Object.fromEntries(
		el.getAttributeNames().map((attr) => [attr, el.getAttribute(attr)!]),
	);
}

function parse_styles(doc: Document): Record<string, IStyleData> {
	const num_fmts = Object.fromEntries(
		[...doc.querySelectorAll('numFmts>numFmt')].map((el) => [
			el.getAttribute('numFmtId')!,
			get_attrs_object(el),
		]),
	);
	const fonts = [...doc.querySelectorAll('fonts>font')].map((font) => ({
		size: font.querySelector('sz')?.getAttribute('val'),
		color: font.querySelector('color')?.getAttribute('rgb'),
		name: font.querySelector('name')?.getAttribute('val'),
		scheme: font.querySelector('scheme')?.getAttribute('val'),
		italic: font.querySelector('i'),
		bold: font.querySelector('b'),
		underline: font.querySelector('u'),
		strikethrough: font.querySelector('strike'),
	}));

	const fills = [...doc.querySelectorAll('fills>fill')].map((fill) => {
		const pattern = fill.firstElementChild;
		if (!pattern) return undefined;
		if (pattern.tagName === 'patternFill') {
			const type = pattern.getAttribute('patternType');
			if (type === 'solid') {
				const fill_color =
					pattern.querySelector('bgColor')?.getAttribute('rgb') ??
					pattern.querySelector('fgColor')?.getAttribute('rgb');
				if (fill_color) return argb_to_rgb(fill_color);
			}
			return {
				gray0625: '#D3D3D3',
				gray125: '#D3D3D3',
				lightGray: '#D3D3D3',
				mediumGray: '#A9A9A9',
				darkGray: '#787878',
			}[type!];
		}
	});

	const borders: Array<IBorderData> = [
		...doc.querySelectorAll('borders>border'),
	].map((border) => {
		const diagonal = border.querySelector('diagonal');
		const data: IBorderData = {
			l: parse_border(border.querySelector('left')),
			r: parse_border(border.querySelector('right')),
			t: parse_border(border.querySelector('top')),
			b: parse_border(border.querySelector('bottom')),
		};
		if (diagonal) {
			const diagonal_key = border.hasAttribute('diagonalDown')
				? 'tl_br'
				: 'bl_tr';
			data[diagonal_key] = parse_border(diagonal);
		}
		return data;
	});

	const styles: Record<string, IStyleData> = {};
	let i = 0;
	for (const el of doc.querySelectorAll('cellXfs>xf')) {
		const n = num_fmts[el.getAttribute('numFmtId')!];
		const font = fonts[Number(el.getAttribute('fontId'))];
		const fill = fills[Number(el.getAttribute('fillId'))];
		const border = borders[Number(el.getAttribute('borderId'))];
		const align_el = el.querySelector('alignment');
		const alignment = align_el ? get_attrs_object(align_el) : null;

		let text_rotation: number | 'v' | undefined;
		if (alignment?.textRotation) {
			const r = Number(alignment.textRotation);
			if (r > 90 && r <= 180) {
				text_rotation = r - 90;
			} else if (r > 180) {
				text_rotation = 'v';
			} else {
				text_rotation = -r;
			}
		}

		styles[i] = {
			fs: font?.size ? Number(font.size) : undefined,
			cl: font?.color ? { rgb: argb_to_rgb(font.color) } : undefined,
			bg: fill ? { rgb: fill } : undefined,
			ht: {
				right: HorizontalAlign.RIGHT,
				center: HorizontalAlign.CENTER,
				left: HorizontalAlign.LEFT,
			}[alignment?.horizontal as string],
			vt: {
				top: VerticalAlign.TOP,
				center: VerticalAlign.MIDDLE,
				bottom: VerticalAlign.BOTTOM,
			}[alignment?.vertical as string],
			tb: {
				0: WrapStrategy.CLIP,
				1: WrapStrategy.WRAP,
			}[alignment?.wrapText as string],
			td: {
				0: TextDirection.UNSPECIFIED,
				1: TextDirection.LEFT_TO_RIGHT,
				2: TextDirection.RIGHT_TO_LEFT,
			}[alignment?.readingOrder as string],
			tr: text_rotation
				? {
						a: text_rotation === 'v' ? 0 : text_rotation,
						v: bn(text_rotation === 'v'),
					}
				: undefined,
			ff: font?.name,
			it: bn(font?.italic),
			bl: bn(font?.bold),
			// TODO: borders
			bd: border,
			n: n?.formatCode ? { pattern: n.formatCode } : undefined,
			st: font?.strikethrough
				? {
						s: bn(true),
						t: TextDecoration.SINGLE,
					}
				: undefined,
			ul: font?.underline
				? {
						s: bn(true),
						t: TextDecoration.SINGLE,
					}
				: undefined,
		};
		i++;
	}
	return styles;
}

function parse_border(el: Element | null): IBorderStyleData | undefined {
	if (!el) return undefined;
	const style = {
		dashDot: BorderStyleTypes.DASH_DOT,
		dashDotDot: BorderStyleTypes.DASH_DOT_DOT,
		dashed: BorderStyleTypes.DASHED,
		dotted: BorderStyleTypes.DOTTED,
		double: BorderStyleTypes.DOUBLE,
		hair: BorderStyleTypes.HAIR,
		medium: BorderStyleTypes.MEDIUM,
		mediumDashDot: BorderStyleTypes.MEDIUM_DASH_DOT,
		mediumDashDotDot: BorderStyleTypes.MEDIUM_DASH_DOT_DOT,
		mediumDashed: BorderStyleTypes.MEDIUM_DASHED,
		slantDashDot: BorderStyleTypes.SLANT_DASH_DOT,
		thick: BorderStyleTypes.THICK,
		thin: BorderStyleTypes.THIN,
	}[el.getAttribute('style') as string];
	if (!style) return undefined;
	const color = el.querySelector('color');
	const rgb = color?.getAttribute('rgb');
	return {
		s: style,
		cl: rgb
			? {
					rgb: argb_to_rgb(rgb),
				}
			: {},
	};
}

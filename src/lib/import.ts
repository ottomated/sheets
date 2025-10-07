import {
	BooleanNumber,
	LocaleType,
	type IWorkbookData,
	type IWorksheetData,
} from '@univerjs/core';
import { BlobReader, ZipReader, TextWriter } from '@zip.js/zip.js';

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
		(rel) =>
			rel.type ===
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
	)?.target;
	if (!workbook_path) {
		throw new Error('no officeDocument found');
	}
	const workbook = await read_xml_file(workbook_path);
	if (!workbook.rels) {
		throw new Error('expected workbook to have rels');
	}

	const sheet_meta = [...workbook.doc.querySelectorAll('sheet')].map(
		(sheet) => ({
			name: sheet.getAttribute('name')!,
			id: sheet.getAttribute('sheetId')!,
			state: sheet.getAttribute('state')!,
			rel_id: sheet.getAttribute('r:id')!,
		}),
	);
	const sheet_root = dirname(workbook_path) + '/';
	const sheets: Record<string, IWorksheetData> = {};
	for (const meta of sheet_meta) {
		const rel = workbook.rels[meta.rel_id];
		if (!rel) throw new Error('no rel found for sheet ' + meta.name);
		const sheet = await read_xml_file(sheet_root + rel.target);

		const freeze_pane = sheet.doc.querySelector('sheetViews>sheetView>pane');
		// koHPrEhBDMlAKNF-nfWdw|New Sheet|2025-10-07T01:22:42.465Z|2025-10-07T01:24:26.914Z|2025-10-07T01:24:31.295Z|{"id":"koHPrEhBDMlAKNF-nfWdw","sheetOrder":["1"],"name":"TODO","appVersion":"0.10.10","locale":"enUS","styles":{},"sheets":{"1":{"id":"1","name":"SheetPog","tabColor":"FF7F6000","hidden":0,"showGridlines":1,"freeze":{"startRow":3,"startColumn":-1,"ySplit":3,"xSplit":0},"rowCount":1000,"columnCount":20,"zoomRatio":1,"scrollTop":0,"scrollLeft":0,"defaultColumnWidth":88,"defaultRowHeight":24,"mergeData":[],"cellData":{},"rowData":{},"columnData":{},"rowHeader":{"width":46,"hidden":0},"columnHeader":{"height":20,"hidden":0},"rightToLeft":0}},"resources":[{"name":"SHEET_RANGE_PROTECTION_PLUGIN","data":""},{"name":"SHEET_AuthzIoMockService_PLUGIN","data":"{}"},{"name":"SHEET_WORKSHEET_PROTECTION_PLUGIN","data":"{}"},{"name":"SHEET_WORKSHEET_PROTECTION_POINT_PLUGIN","data":"{}"},{"name":"SHEET_DEFINED_NAME_PLUGIN","data":""},{"name":"SHEET_RANGE_THEME_MODEL_PLUGIN","data":"{}"}]}
		let freeze: IWorksheetData['freeze'] = {
			xSplit: 0,
			ySplit: 0,
			startRow: 0,
			startColumn: 0,
		};
		if (freeze_pane) {
			const x_split = Number(freeze_pane.getAttribute('xSplit'));
			if (!Number.isNaN(x_split)) {
				freeze.xSplit = x_split;
				freeze.startColumn = x_split + 1;
			}
			const y_split = Number(freeze_pane.getAttribute('ySplit'));
			if (!Number.isNaN(y_split)) {
				freeze.ySplit = y_split;
				freeze.startRow = y_split + 1;
			}
		}

		sheets[meta.id] = {
			id: meta.id,
			name: meta.name,
			tabColor:
				sheet.doc.querySelector('sheetPr > tabColor')?.getAttribute('rgb') ??
				'transparent', // TODO - ARGB -> RGB
			hidden:
				meta.state === 'visible' ? BooleanNumber.FALSE : BooleanNumber.TRUE,
			showGridlines:
				sheet.doc
					.querySelector('sheetViews>sheetView')
					?.getAttribute('showGridLines') === '0'
					? BooleanNumber.FALSE
					: BooleanNumber.TRUE,
			freeze,
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

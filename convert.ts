import { IWorksheetData, LocaleType, type IWorkbookData } from '@univerjs/core';
import { readFile, writeFile } from 'fs/promises';
import { read } from 'xlsx';

const file = {
	name: 'Otto Part Time Hours.xlsx',
	arrayBuffer: async () => {
		return await readFile('/home/otto/Downloads/Otto Part Time Hours.xlsx');
	},
};

const data = await file.arrayBuffer();
const workbook = read(data);
await writeFile('./workbook.json', JSON.stringify(workbook, null, '\t'));
const new_sheet: Omit<IWorkbookData, 'id' | 'appVersion'> = {
	name: file.name.substring(0, file.name.lastIndexOf('.')),
	locale: LocaleType.EN_US,
	styles: {},
	sheetOrder: workbook.SheetNames.map((_, i) => `imported-${i}`),
	sheets: Object.fromEntries(
		workbook.SheetNames.map((name, i) => {
			const sheet = workbook.Sheets[name]!;
			return [
				`imported-${i}`,
				{
					id: `imported-${i}`,
					name,
					tabColor: 'transparent',
					hidden: false,
				} satisfies IWorksheetData,
			];
		}),
	),
};
console.log(new_sheet);

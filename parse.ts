import { parse_xlsx } from './src/lib/import.ts';
import { Blob } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
const file = new Blob([
	await readFile('/home/otto/Downloads/Otto Part Time Hours.xlsx'),
]);

const doc = await parse_xlsx(file);
console.log(JSON.stringify(doc));

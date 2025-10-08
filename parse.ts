import Database from 'better-sqlite3';
import { get_univer } from './src/lib/server/univer.ts';
import { parse_xlsx } from './src/lib/import.ts';
import { Blob } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const id = 'asHn3p-eTd3xDYPAHpU2w';
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
const file = new Blob([await readFile('/home/otto/Downloads/tes(7).xlsx')]);
const doc = await parse_xlsx(file);
doc.id = id;
console.log(JSON.stringify(doc));
// const { univer_api } = await get_univer();
// const workbook = univer_api.createWorkbook(doc, { makeCurrent: false });
// console.log(workbook.save().sheets[1].cellData[1][2]);
const database = new Database('data/data.db');
database.exec(`INSERT INTO
  "Sheet" ("id", "name", "data", "created_at", "updated_at")
VALUES
  ('${id}', 'IMPORT TEST', '${JSON.stringify(doc)}', '${new Date().toISOString()}', '${new Date().toISOString()}')
ON CONFLICT ("id") DO
UPDATE
SET
  "data" = '${JSON.stringify(doc)}'`);

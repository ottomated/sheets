import { form, query } from '$app/server';
import z from 'zod';
import { db } from './db';
import { error } from '@sveltejs/kit';
import { get_univer } from './server/univer';
// import { nanoid } from 'nanoid';
// import { get_univer } from './univer';
// import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
// import locale from '@univerjs/preset-sheets-node-core/locales/en-US';
// import { UniverSheetsNodeCorePreset } from '@univerjs/preset-sheets-node-core';
// import { univer_api } from './server/univer';

export const get_sheet = query(z.string(), async (id) => {
	const sheet = await db
		.selectFrom('Sheet')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
	if (!sheet) error(404, 'Sheet not found');
	return sheet;
});

export const list_sheets = query(async () => {
	return await db
		.selectFrom('Sheet')
		.select(['id', 'name', 'updated_at'])
		.execute();
});

export const create_sheet = form(async () => {
	const { univer, univer_api } = await get_univer();
	const workbook = univer_api.createWorkbook(
		{
			id: '',
			name: 'New Sheet',
		},
		{ makeCurrent: false },
	);

	await db
		.insertInto('Sheet')
		.values({
			id: workbook.id,
			name: workbook.getName(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			data: JSON.stringify(workbook.save()),
		})
		.execute();
	await list_sheets().refresh();

	univer.dispose();
	univer_api.dispose();
});

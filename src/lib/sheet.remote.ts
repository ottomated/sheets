import { command, form, query } from '$app/server';
import z from 'zod';
import { db } from './db';
import { error, redirect } from '@sveltejs/kit';
import { get_univer } from './server/univer';
import { nanoid } from 'nanoid';
import { resolve } from '$app/paths';
import { LocaleType } from '@univerjs/core';

export const get_sheet = query(z.nanoid(), async (id) => {
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
		.select(['id', 'name', 'updated_at', 'opened_at'])
		.orderBy('opened_at', 'desc')
		.execute();
});

export const create_sheet = form(async () => {
	const { univer_api } = await get_univer();
	const workbook = univer_api.createWorkbook(
		{
			id: nanoid(),
			name: 'New Sheet',
			locale: LocaleType.EN_US,
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
	univer_api.disposeUnit(workbook.id);
	redirect(303, resolve('/sheet/[id]', { id: workbook.id }));
});

export const save_sheet = command(
	z.object({
		id: z.nanoid(),
		base: z.string(),
		data: z.string(),
	}),
	async ({ id, base, data }) => {
		const updated_at = new Date().toISOString();

		const res = await db
			.updateTable('Sheet')
			.set({ data, updated_at })
			.where('id', '=', id)
			.where('updated_at', '=', base)
			.executeTakeFirst();
		if (res.numUpdatedRows === 0n) {
			// this will throw a 404 if the sheet doesn't exist, which is good
			await get_sheet(id).refresh();
			return { error: 'Sheet has been updated by another user' };
		}
		return { base: updated_at };
	},
);

export const rename_sheet = command(
	z.object({
		id: z.nanoid(),
		name: z.string(),
	}),
	async ({ id, name }) => {
		const res = await db
			.updateTable('Sheet')
			.set({ name })
			.where('id', '=', id)
			.executeTakeFirst();
		if (res.numUpdatedRows === 0n) error(404, 'Sheet not found');
	},
);

export const open_sheet = command(z.nanoid(), async (id) => {
	await db
		.updateTable('Sheet')
		.set({ opened_at: new Date().toISOString() })
		.where('id', '=', id)
		.executeTakeFirst();
});

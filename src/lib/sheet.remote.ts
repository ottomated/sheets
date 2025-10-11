import { command, form, query } from '$app/server';
import z from 'zod';
import { db } from './db';
import { error, redirect } from '@sveltejs/kit';
import { get_univer } from './server/univer';
import { nanoid } from 'nanoid';
import { resolve } from '$app/paths';
import { LocaleType } from '@univerjs/core';
import { check_auth } from './server/auth';

export const get_sheet = query(z.string(), async (id) => {
	check_auth();
	const sheet = await db
		.selectFrom('Sheet')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
	if (!sheet) error(404, 'Sheet not found');
	return sheet;
});

export const get_shared_links = query(z.string(), async (id) => {
	check_auth();
	return await db
		.selectFrom('SharedLink as link')
		.selectAll()
		.where('link.sheet_id', '=', id)
		.execute();
});

const delete_after = 1000 * 60 * 60 * 24 * 7; // 7 days

export const list_sheets = query(async () => {
	check_auth();
	db.deleteFrom('Sheet')
		.where('deleted_at', '<', new Date(Date.now() - delete_after).toISOString())
		.execute();
	return await db
		.selectFrom('Sheet')
		.select(['id', 'name', 'updated_at', 'opened_at', 'deleted_at'])
		.orderBy('opened_at', (order) => order.desc().nullsFirst())
		.execute();
});

export const create_sheet = form(async () => {
	check_auth();
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

export const permanently_delete_sheet = command(z.string(), async (id) => {
	check_auth();
	await db.deleteFrom('Sheet').where('id', '=', id).execute();
	await list_sheets().refresh();
});

export const import_sheet = command(z.string(), async (data) => {
	check_auth();
	const parsed = JSON.parse(data);
	await db
		.insertInto('Sheet')
		.values({
			id: parsed.id,
			name: parsed.name,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			data,
		})
		.execute();
});

export const save_sheet = command(
	z.object({
		id: z.string(),
		base: z.string(),
		data: z.string(),
	}),
	async ({ id, base, data }) => {
		check_auth();
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
			// console.log('conflict:', sheet.updated_at, base);
			return { error: 'Sheet has been updated by another user' };
		}
		return { base: updated_at };
	},
);

export const update_sheet_details = command(
	z.object({
		id: z.nanoid(),
		name: z.string().optional(),
		deleted: z.boolean().optional(),
		opened: z.literal(true).optional(),
	}),
	async ({ id, ...input }) => {
		check_auth();
		const res = await db
			.updateTable('Sheet')
			.set({
				name: input.name,
				deleted_at: input.deleted ? new Date().toISOString() : null,
				opened_at: input.opened ? new Date().toISOString() : undefined,
			})
			.where('id', '=', id)
			.executeTakeFirst();
		if (res.numUpdatedRows === 0n) error(404, 'Sheet not found');
	},
);

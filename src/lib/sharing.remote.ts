import { command, form, query } from '$app/server';
import z from 'zod';
import { db } from './db';
import { error } from '@sveltejs/kit';
import { check_auth } from './server/auth';
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';
import { get_shared_links } from './sheet.remote';

export const get_shared_sheet = query(z.string(), async (id) => {
	const sheet = await db
		.selectFrom('SharedLink as link')
		.innerJoin('Sheet as s', 's.id', 'link.sheet_id')
		.select([
			's.id',
			's.name',
			's.data',
			's.updated_at',
			'link.access_type',
			'link.expires_at',
		])
		.where('link.id', '=', id)
		.executeTakeFirst();
	if (!sheet) error(404, 'Invalid shared link');
	if (sheet.expires_at && new Date(sheet.expires_at) < new Date()) {
		error(404, 'Shared link has expired');
	}
	return sheet;
});
export const save_shared_sheet = command(
	z.object({
		link_id: z.string(),
		data: z.string(),
		base: z.string(),
	}),
	async ({ link_id, data, base }) => {
		const sheet = await db
			.selectFrom('SharedLink as link')
			.innerJoin('Sheet as s', 's.id', 'link.sheet_id')
			.select(['link.expires_at', 's.id'])
			.where('link.id', '=', link_id)
			.executeTakeFirst();
		if (!sheet) error(404, 'Invalid shared link');
		if (sheet.expires_at && new Date(sheet.expires_at) < new Date()) {
			error(404, 'Shared link has expired');
		}

		const updated_at = new Date().toISOString();

		const res = await db
			.updateTable('Sheet')
			.set({ data, updated_at })
			.where('id', '=', sheet.id)
			.where('updated_at', '=', base)
			.executeTakeFirst();
		if (res.numUpdatedRows === 0n) {
			// this will throw a 404 if the sheet doesn't exist, which is good
			await get_shared_sheet(link_id).refresh();
			return { error: 'Sheet has been updated by another user' };
		}
		return { base: updated_at };
	},
);

export const delete_shared_link = command(
	z.object({ link_id: z.string(), sheet_id: z.string() }),
	async ({ link_id, sheet_id }) => {
		check_auth();
		const res = await db
			.deleteFrom('SharedLink')
			.where('id', '=', link_id)
			.executeTakeFirst();
		if (res.numDeletedRows === 0n) error(404, 'Shared link not found');
		await get_shared_links(sheet_id).refresh();
	},
);

export const create_shared_link = form(
	z.object({
		sheet_id: z.string(),
		duration_seconds: z.coerce.number<string>().optional(),
		access_type: z.enum(['read', 'write']),
	}),
	async ({ sheet_id, duration_seconds, access_type }) => {
		check_auth();
		const sheet = await db
			.selectFrom('Sheet')
			.select('id')
			.where('id', '=', sheet_id)
			.executeTakeFirst();
		if (!sheet) error(404, 'Sheet not found');

		const bytes = new Uint8Array(48);
		crypto.getRandomValues(bytes);
		const id = encodeBase32LowerCaseNoPadding(bytes);
		await db
			.insertInto('SharedLink')
			.values({
				id,
				sheet_id: sheet.id,
				access_type,
				created_at: new Date().toISOString(),
				expires_at: duration_seconds
					? new Date(Date.now() + duration_seconds * 1000).toISOString()
					: null,
			})
			.execute();
		await get_shared_links(sheet.id).refresh();
		return { id };
	},
);

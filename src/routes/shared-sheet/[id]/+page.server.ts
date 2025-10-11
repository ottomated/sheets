import { resolve } from '$app/paths';
import { db } from '$lib/db/index.js';
import { get_shared_sheet } from '$lib/sharing.remote';
import { redirect } from '@sveltejs/kit';

export const load = async ({ params, locals }) => {
	if (locals.user) {
		const sheet = await db
			.selectFrom('SharedLink as link')
			.innerJoin('Sheet as s', 's.id', 'link.sheet_id')
			.select('s.id')
			.where('link.id', '=', params.id)
			.executeTakeFirst();
		if (sheet) redirect(307, resolve('/sheet/[id]', { id: sheet.id }));
	}
	return {
		sheet: await get_shared_sheet(params.id),
	};
};

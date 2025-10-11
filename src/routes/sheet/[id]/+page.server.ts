import { get_sheet } from '$lib/sheet.remote';

export const load = async ({ params }) => {
	return {
		sheet: await get_sheet(params.id),
	};
};

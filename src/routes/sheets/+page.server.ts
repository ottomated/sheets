import { list_sheets } from '$lib/sheet.remote';

export const load = async () => {
	return {
		sheets: await list_sheets(),
	};
};

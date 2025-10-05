import { browser } from '$app/environment';
import type { FUniver } from '@univerjs/presets';

type Instance = {
	attachment: (node: HTMLElement) => void;
	api: FUniver;
};

let instance = $state<Instance>();

export const univer = {
	get api() {
		return instance?.api;
	},
	get attachment() {
		return instance?.attachment;
	},
};

if (browser) {
	const container = document.createElement('div');
	container.className = 'w-full h-full';

	const is_dark = window.matchMedia('(prefers-color-scheme: dark)');
	is_dark.addEventListener('change', (ev) => {
		if (!instance) return;
		instance.api.toggleDarkMode(ev.matches);
	});
	Promise.all([
		import('@univerjs/presets'),
		import('@univerjs/preset-sheets-core'),
		import('@univerjs/preset-sheets-core/locales/en-US'),
	]).then(
		([
			{ createUniver, mergeLocales, LocaleType },
			{ UniverSheetsCorePreset },
			{ default: locale },
		]) => {
			const { univerAPI } = createUniver({
				locale: LocaleType.EN_US,
				locales: {
					[LocaleType.EN_US]: mergeLocales(locale),
				},
				darkMode: is_dark.matches,
				presets: [
					UniverSheetsCorePreset({
						container,
					}),
				],
			});
			instance = {
				attachment: (node) => {
					node.appendChild(container);
				},
				api: univerAPI,
			};
		},
	);
}

import { browser } from '$app/environment';
import { type FUniver } from '@univerjs/presets';

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

// type Resource = {
// 	[sheet_id: string]: {
// 		rows: number[];
// 		cols: number[];
// 	};
// };
// class AutoSizeImportedSheets extends Plugin {
// 	static override pluginName = 'auto-size-imported-plugin';
// 	private _model: Resource = {};
// 	protected _injector: Injector;

// 	constructor(
// 		injector: Injector,
// 		commandService: ICommandService,
// 		resourceManager: IResourceManagerService,
// 		instanceService: IUniverInstanceService,
// 	) {
// 		super();
// 		this._injector = injector;
// 		resourceManager.registerPluginResource<Resource>({
// 			toJson: () => JSON.stringify(this._model),
// 			parseJson: (json) => JSON.parse(json),
// 			pluginName: `SHEET_AutoSize_PLUGIN`,
// 			businesses: [UniverInstanceType.UNIVER_SHEET],
// 			onLoad: (_, res) => (this._model = res),
// 			onUnLoad: () => (this._model = {}),
// 		});
// 	}
// 	dispose() {}
// 	onRendered() {
// 		console.log('rendered');
// 	}
// }
// setDependencies(AutoSizeImportedSheets, [
// 	Injector,
// 	ICommandService,
// 	IResourceManagerService,
// 	IUniverInstanceService,
// ]);

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
		import('@univerjs/preset-sheets-hyper-link'),
		import('@univerjs/preset-sheets-hyper-link/locales/en-US'),
	]).then(
		([
			{ createUniver, mergeLocales, LocaleType },
			{ UniverSheetsCorePreset },
			{ default: locale },
			{ UniverSheetsHyperLinkPreset },
			{ default: hyperlink_locale },
		]) => {
			const { univerAPI } = createUniver({
				locale: LocaleType.EN_US,
				locales: {
					[LocaleType.EN_US]: mergeLocales(locale, hyperlink_locale),
				},
				darkMode: is_dark.matches,
				presets: [
					UniverSheetsCorePreset({
						container,
					}),
					UniverSheetsHyperLinkPreset(),
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

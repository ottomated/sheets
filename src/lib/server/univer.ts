import {
	LocaleType,
	mergeLocales,
	Univer,
	UniverInstanceType,
} from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';

import '@univerjs/engine-formula/facade';
import '@univerjs/sheets/facade';
import '@univerjs/sheets-formula/facade';
import '@univerjs/sheets-numfmt/facade';
import { UniverDocsPlugin } from '@univerjs/preset-sheets-core';

export async function get_univer() {
	const univer = new Univer({
		locale: LocaleType.EN_US,
		locales: {
			[LocaleType.EN_US]: mergeLocales(SheetsEnUS),
		},
	});

	univer.registerPlugin(UniverRenderEnginePlugin);
	univer.registerPlugin(UniverDocsPlugin);
	// univer.registerPlugin(UniverDocsUIPlugin);
	univer.registerPlugin(UniverFormulaEnginePlugin);
	univer.registerPlugin(UniverSheetsPlugin);
	// univer.registerPlugin(UniverSheetsUIPlugin);
	univer.registerPlugin(UniverSheetsFormulaPlugin);
	univer.registerPlugin(UniverSheetsNumfmtPlugin);
	// wait for the plugins to load
	await Promise.resolve();
	const univer_api = FUniver.newAPI(univer);

	univer.createUnit(UniverInstanceType.UNIVER_SHEET, {});
	return { univer, univer_api };
}

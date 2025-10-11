<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { univer } from '$lib/univer.svelte';
	import { CommandType } from '@univerjs/core';
	import { type get_sheet, save_sheet } from '$lib/sheet.remote';
	import type { FWorkbook } from '@univerjs/preset-sheets-core';

	const {
		sheet,
		ondirty,
		onsaveerror,
		...props
	}: {
		sheet: Awaited<ReturnType<typeof get_sheet>>;
		ondirty?: (dirty: boolean) => void;
		onsaveerror?: (error: string) => void;
	} & HTMLAttributes<HTMLDivElement> = $props();

	let base = $derived(sheet.updated_at);

	// function
	let last_save_ts = 0;
	let last_save_value = sheet.data;
	$effect(() => {
		last_save_value = sheet.data;
	});
	let timeout: ReturnType<typeof setTimeout> | undefined;
	async function save(id: string, data: string) {
		ondirty?.(true);
		const now = Date.now();
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (now - last_save_ts < 500) {
			timeout = setTimeout(async () => {
				last_save_ts = now;
				await do_save(id, data);
			}, 500);
			return;
		}
		last_save_ts = now;
		await do_save(id, data);
	}

	async function do_save(id: string, data: string) {
		try {
			const res = await save_sheet({
				id,
				data,
				base,
			});
			if (res.error) {
				onsaveerror?.(res.error);
				ondirty?.(false);
				return;
			}
			ondirty?.(false);
			onsaveerror?.('');
			if (res.base) base = res.base;
		} catch (err) {
			onsaveerror?.(String(err));
		}
	}

	let workbook: FWorkbook;
	const data = $derived(JSON.parse(sheet.data));
	$effect(() => {
		// $inspect.trace('load workbook');
		const api = univer.api;
		if (!api) return;
		workbook = api.createWorkbook(data);
		const listener = api.addEvent('CommandExecuted', async (ev) => {
			// console.log(ev);
			if (
				ev.id === 'sheet.operation.set-worksheet-active' &&
				ev.params.unitId === sheet.id
			) {
				location.hash = `gid=${ev.params.subUnitId}`;
			}
			if (ev.type !== CommandType.MUTATION) return;

			// This seems to fire when you type in the top editor
			if (
				ev.id === 'doc.mutation.rich-text-editing' &&
				ev.params.unitId === '__INTERNAL_EDITOR__DOCS_NORMAL'
			)
				return;

			const save_value = JSON.stringify(workbook.save());
			if (save_value === last_save_value) return;
			last_save_value = save_value;

			save(workbook.id, save_value);
		});
		const hash = new URLSearchParams(location.hash.substring(1));
		if (hash.has('gid')) {
			workbook.setActiveSheet(hash.get('gid')!);
		}
		return () => {
			listener.dispose();
			// loaded_listener.dispose();
			api.disposeUnit(workbook.id);
		};
	});
	// onMount(() => {
	// 	const interval = setInterval(() => {
	// 		const meta = workbook?.getCustomMetadata() as {
	// 			recalc?: Record<string, { rows: number[]; cols: number[] }>;
	// 		};
	// 		if (!meta?.recalc) return;
	// 		const sheet = workbook.getActiveSheet();
	// 		if (!sheet) return;
	// 		const sheet_recalc = meta.recalc[sheet.getSheetId()];
	// 		if (!sheet_recalc) return;

	// 		console.time('recalc');
	// 		const rows = sheet_recalc.rows.splice(0, 10);
	// 		for (const row of rows) {
	// 			sheet.autoResizeRows(row, 1);
	// 		}
	// 		const cols = sheet_recalc.cols.splice(0, 10);
	// 		for (const col of cols) {
	// 			sheet.autoResizeColumn(col);
	// 		}
	// 		console.timeEnd('recalc');
	// 		if (sheet_recalc.rows.length === 0 && sheet_recalc.cols.length === 0) {
	// 			delete meta.recalc[sheet.getSheetId()];
	// 			if (Object.keys(meta.recalc).length === 0) {
	// 				delete meta.recalc;
	// 			}
	// 		}
	// 		workbook.setCustomMetadata(meta);
	// 	}, 5000);
	// 	return () => {
	// 		clearInterval(interval);
	// 	};
	// });
</script>

<!-- <svelte:window
	onkeydown={(ev) => {
		const sheet = workbook.getActiveSheet();
		sheet.autoResizeColumn(1);
	}}
/> -->

<div {...props} {@attach univer.attachment}></div>

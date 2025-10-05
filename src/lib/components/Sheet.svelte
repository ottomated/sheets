<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { univer } from '$lib/univer.svelte';
	import { CommandType } from '@univerjs/core';
	import { type get_sheet, save_sheet } from '$lib/sheet.remote';

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
	let last_save_value = $derived(sheet.data);
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

	const data = $derived(JSON.parse(sheet.data));
	$effect(() => {
		const api = univer.api;
		if (!api) return;
		const workbook = api.createWorkbook(data);
		const listener = api.addEvent('CommandExecuted', async (ev) => {
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

		return () => {
			listener.dispose();
			api.disposeUnit(workbook.id);
		};
	});
</script>

<div {...props} {@attach univer.attachment}></div>

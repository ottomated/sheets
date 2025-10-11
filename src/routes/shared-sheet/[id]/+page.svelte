<script lang="ts">
	import '@univerjs/preset-sheets-core/lib/index.css';
	import '@univerjs/preset-sheets-hyper-link/lib/index.css';
	import Sheet from '$lib/components/Sheet.svelte';
	import { FileSpreadsheet, Save } from '@o7/icon';

	import { get_shared_sheet, save_shared_sheet } from '$lib/sharing.remote.js';

	const { params, data } = $props();

	const sheet_fn = $derived(get_shared_sheet(params.id));
	const sheet = $derived(sheet_fn.current ?? data.sheet);

	let dirty = $state(false);
	let save_error = $state('');
	let save_error_timeout: ReturnType<typeof setTimeout> | undefined;
</script>

<svelte:window
	onbeforeunload={(ev) => {
		if (dirty) {
			ev.preventDefault();
			ev.returnValue = '';
		}
	}}
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') {
			get_shared_sheet(params.id).refresh();
		}
	}}
/>

<div
	class="flex h-screen w-screen flex-col overflow-hidden dark:bg-zinc-900 dark:text-white"
>
	<nav class="flex items-center gap-2 p-2">
		<FileSpreadsheet size={40} />
		<span class="py-0.5 pl-2 pr-4">{sheet.name}</span>

		{#if save_error}
			<p class="rounded-full bg-red-500 px-2 font-bold text-black">
				{save_error}
			</p>
		{/if}
		{#if dirty}
			<p class="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
				<Save size={20} class="inline-block" />
				Saving...
			</p>
		{/if}
	</nav>
	<Sheet
		{sheet}
		save_fn={async (data, base) => {
			if (sheet.access_type !== 'write') throw new Error('Read-only');
			return await save_shared_sheet({
				link_id: params.id,
				data,
				base,
			});
		}}
		readonly={sheet.access_type === 'read'}
		ondirty={(d) => (dirty = d)}
		onsaveerror={(err) => {
			if (save_error_timeout) clearTimeout(save_error_timeout);
			save_error = err;
			save_error_timeout = setTimeout(() => (save_error = ''), 10_000);
		}}
		class="flex-1"
	/>
</div>

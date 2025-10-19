<script lang="ts">
	import '@univerjs/preset-sheets-core/lib/index.css';
	import '@univerjs/preset-sheets-hyper-link/lib/index.css';
	import {
		get_sheet,
		save_sheet,
		update_sheet_details,
	} from '$lib/sheet.remote';
	import Sheet from '$lib/components/Sheet.svelte';
	import { FileSpreadsheet, Save } from '@o7/icon';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import ShareDialog from './ShareDialog.svelte';
	import Nav from '$lib/components/Nav.svelte';

	const { params, data } = $props();

	const sheet_fn = $derived(get_sheet(params.id));
	const sheet = $derived(sheet_fn.current ?? data.sheet);

	$effect(() => {
		const id = params.id;
		untrack(() => update_sheet_details({ id, opened: true }));
	});

	let name = $derived(sheet.name);

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
			get_sheet(params.id).refresh();
		}
	}}
/>

<svelte:head>
	<title>{sheet.name} | Ottomated Sheets</title>
</svelte:head>

<div
	class="flex h-screen w-screen flex-col overflow-hidden dark:bg-zinc-900 dark:text-white"
>
	<Nav href="/">
		<input
			autocomplete="off"
			class="flex-1 rounded-md border border-transparent bg-transparent py-0.5 pl-2 pr-4 outline-none ring-purple-600 hover:border-current focus-visible:border-purple-500 focus-visible:ring-1"
			type="text"
			bind:value={name}
			onchange={(ev) => {
				update_sheet_details({ id: sheet.id, name: ev.currentTarget.value });
			}}
			{@attach (node) => {
				const measure = document.createElement('span');
				measure.setAttribute('aria-hidden', 'true');
				measure.className =
					'fixed select-none top-[-1000px] whitespace-pre ' + node.className;
				document.body.appendChild(measure);
				$effect(() => {
					measure.textContent = name;
					node.style.maxWidth = `${measure.getBoundingClientRect().width}px`;
				});
				return () => {
					document.body.removeChild(measure);
				};
			}}
		/>
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
		<ShareDialog sheet_id={sheet.id} />
	</Nav>
	<Sheet
		{sheet}
		save_fn={async (data, base) => {
			return await save_sheet({
				id: sheet.id,
				data,
				base,
			});
		}}
		ondirty={(d) => (dirty = d)}
		onsaveerror={(err) => {
			if (save_error_timeout) clearTimeout(save_error_timeout);
			save_error = err;
			save_error_timeout = setTimeout(() => (save_error = ''), 10_000);
		}}
		class="flex-1"
	/>
</div>

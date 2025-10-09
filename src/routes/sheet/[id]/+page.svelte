<script lang="ts">
	import '@univerjs/preset-sheets-core/lib/index.css';
	import '@univerjs/preset-sheets-hyper-link/lib/index.css';
	import { get_sheet, open_sheet, rename_sheet } from '$lib/sheet.remote';
	import Sheet from '$lib/components/Sheet.svelte';
	import { FileSpreadsheet, Save } from '@o7/icon';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';

	const { params } = $props();

	const sheet = $derived(await get_sheet(params.id));

	$effect(() => {
		const id = params.id;
		untrack(() => open_sheet(id));
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

<div
	class="flex h-screen w-screen flex-col overflow-hidden dark:bg-zinc-900 dark:text-white"
>
	<nav class="flex items-center gap-2 p-2">
		<a href={resolve('/')} aria-label="Home">
			<FileSpreadsheet size={40} />
		</a>
		<input
			autocomplete="off"
			class="rounded-md border border-transparent bg-transparent py-0.5 pl-2 pr-4 outline-none ring-purple-600 hover:border-current focus-visible:border-purple-500 focus-visible:ring-1"
			type="text"
			bind:value={name}
			onchange={(ev) => {
				rename_sheet({ id: sheet.id, name: ev.currentTarget.value });
			}}
			{@attach (node) => {
				const measure = document.createElement('span');
				measure.setAttribute('aria-hidden', 'true');
				measure.className =
					'fixed select-none top-[-1000px] whitespace-pre ' + node.className;
				document.body.appendChild(measure);
				$effect(() => {
					measure.textContent = name;
					node.style.width = `${measure.getBoundingClientRect().width}px`;
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
	</nav>
	<Sheet
		{sheet}
		ondirty={(d) => (dirty = d)}
		onsaveerror={(err) => {
			if (save_error_timeout) clearTimeout(save_error_timeout);
			save_error = err;
			save_error_timeout = setTimeout(() => (save_error = ''), 10_000);
		}}
		class="flex-1"
	/>
</div>

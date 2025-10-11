<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		create_sheet,
		list_sheets,
		permanently_delete_sheet,
		update_sheet_details,
	} from '$lib/sheet.remote';
	import {
		ArchiveRestore,
		EllipsisVertical,
		FilePlus2,
		FileSpreadsheet,
		Import,
		Trash2,
	} from '@o7/icon';
	import { onMount, tick } from 'svelte';
	import type TImportDialog from '$lib/components/Import.svelte';

	const { data } = $props();
	const sheets_fn = $derived(list_sheets());
	const sheets = $derived(sheets_fn.current ?? data.sheets);

	let now = $state(Date.now());
	onMount(() => {
		const i = setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => {
			clearInterval(i);
		};
	});

	const group_keys: Array<{ name: string; cutoff: number }> = [
		{
			name: 'Today',
			cutoff: 1000 * 60 * 60 * 24,
		},
		{
			name: 'Yesterday',
			cutoff: 1000 * 60 * 60 * 24 * 2,
		},
		{
			name: 'This Week',
			cutoff: 1000 * 60 * 60 * 24 * 7,
		},
		{
			name: 'This Month',
			cutoff: 1000 * 60 * 60 * 24 * 30,
		},
		{
			name: 'Earlier',
			cutoff: Infinity,
		},
		{
			name: 'Deleted',
			cutoff: Infinity,
		},
	];
	const grouped = $derived.by(() => {
		const map = new Map<string, typeof sheets>();
		for (const sheet of sheets) {
			const opened_at = sheet.opened_at
				? new Date(sheet.opened_at).getTime()
				: Date.now();
			let group_name: string;
			if (sheet.deleted_at) {
				group_name = 'Deleted';
			} else {
				const since_opened = now - opened_at;
				const group = group_keys.find((g) => since_opened < g.cutoff)!;
				group_name = group.name;
			}

			if (!map.has(group_name)) map.set(group_name, []);
			map.get(group_name)!.push(sheet);
		}
		return map;
	});

	let ImportDialog =
		$state<typeof import('$lib/components/Import.svelte').default>();

	// svelte-ignore non_reactive_update
	let dialog: TImportDialog;
</script>

<svelte:window
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') {
			list_sheets().refresh();
		}
	}}
	onclick={(ev) => {
		if (
			!ev.target ||
			!('closest' in ev.target) ||
			typeof ev.target.closest !== 'function'
		)
			return;
		const summary = ev.target.closest('summary');
		for (const details of document.querySelectorAll<HTMLDetailsElement>(
			'details[open]',
		)) {
			if (details.firstChild === summary) continue;
			details.open = false;
		}
	}}
/>

<nav class="flex items-center gap-2 p-2">
	<FileSpreadsheet size={40} />
	<h1 class="select-none text-2xl font-bold">Sheets</h1>
</nav>
<section class="mx-auto max-w-screen-md p-4">
	<h2 class="text-lg">Create Spreadsheet</h2>

	<div class="flex gap-4 py-2">
		<form {...create_sheet}>
			<button>
				<div
					class="flex aspect-video w-32 items-center justify-center rounded-sm bg-zinc-200 text-purple-700 dark:bg-zinc-800 dark:text-purple-400"
				>
					<FilePlus2 size={40} />
				</div>
				New Empty
			</button>
		</form>
		<button
			onclick={async () => {
				if (!ImportDialog) {
					const module = await import('$lib/components/Import.svelte');
					ImportDialog = module.default
				}
				await tick();
				dialog.show();
			}}
		>
			<div
				class="flex aspect-video w-32 items-center justify-center rounded-sm bg-zinc-200 text-green-700 dark:bg-zinc-800 dark:text-green-400"
			>
				<Import size={40} />
			</div>
			Import Sheet
		</button>
	</div>
</section>
<section class="mx-auto max-w-screen-md p-4">
	{#each group_keys as group (group.name)}
		{@const sheets = grouped.get(group.name)}
		{#if sheets}
			<h2 class="text-xl font-bold">{group.name}</h2>
			<ul class="space-y-2 py-2">
				{#each sheets as sheet (sheet.id)}
					<li class="flex items-center gap-2">
						<a
							href={resolve('/sheet/[id]', { id: sheet.id })}
							class="flex flex-1 items-center gap-2 rounded-sm bg-zinc-200 p-4 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
						>
							<span class="flex-1 truncate font-medium">{sheet.name}</span>
							<span>
								{#if sheet.opened_at}
									{new Date(sheet.opened_at).toLocaleString()}
								{:else}
									<span class="text-neutral-500">Not Opened</span>
								{/if}
							</span>
						</a>
						<details class="relative">
							<summary
								class="block cursor-pointer rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
							>
								<EllipsisVertical />
							</summary>
							<ul
								class="absolute right-0 top-1/2 z-10 rounded-md bg-zinc-300 py-2 dark:bg-zinc-700"
							>
								<li>
									{#if sheet.deleted_at}
										<button
											onclick={() => {
												update_sheet_details({
													id: sheet.id,
													deleted: false,
												}).updates(list_sheets());
											}}
											class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-lg hover:bg-black/10 dark:hover:bg-white/10"
										>
											<ArchiveRestore />
											Restore from Trash
										</button>
									{/if}
									<button
										onclick={() => {
											if (sheet.deleted_at) {
												permanently_delete_sheet(sheet.id);
											} else {
												update_sheet_details({
													id: sheet.id,
													deleted: true,
												}).updates(list_sheets());
											}
										}}
										class:text-red-500={sheet.deleted_at}
										class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-lg hover:bg-black/10 dark:hover:bg-white/10"
									>
										<Trash2 />
										{#if sheet.deleted_at}Permanently{/if}
										Delete
									</button>
								</li>
							</ul>
						</details>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</section>

{#if ImportDialog}
	<ImportDialog bind:this={dialog} />
{/if}

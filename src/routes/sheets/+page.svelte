<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		create_sheet,
		list_sheets,
		update_sheet_details,
	} from '$lib/sheet.remote';
	import { FilePlus2, Import } from '@o7/icon';
	import { onMount, tick } from 'svelte';
	import type TImportDialog from '$lib/components/Import.svelte';
	import SheetMenu from './SheetMenu.svelte';
	import Nav from '$lib/components/Nav.svelte';

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

	let renaming_id = $state<string | null>(null);
	async function start_renaming(id: string) {
		renaming_id = id;
		await tick();
		const input = document.getElementById(
			`rename-${id}`,
		) as HTMLInputElement | null;
		if (!input) return;
		input.focus();
		input.select();
	}
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

<Nav>
	<h1
		class="font-mono ml-2 mr-auto select-none text-2xl font-bold text-purple-600"
	>
		Sheets
	</h1>
</Nav>
<section class="mx-auto max-w-screen-md p-4">
	<h2 class="text-lg">Create Spreadsheet</h2>

	<div class="flex gap-4 py-2">
		<form {...create_sheet}>
			<button>
				<div
					class="flex aspect-video w-32 items-center justify-center rounded-sm bg-zinc-200 text-purple-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-purple-400 dark:hover:bg-zinc-700"
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
				class="flex aspect-video w-32 items-center justify-center rounded-sm bg-zinc-200 text-green-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-green-400 dark:hover:bg-zinc-700"
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
			<h2 class="mt-4 text-xl font-bold">{group.name}</h2>
			<ul class="space-y-2 py-2">
				{#each sheets as sheet (sheet.id)}
					{@const renaming = renaming_id === sheet.id}
					<li class="flex items-center gap-2">
						<svelte:element
							this={renaming ? 'div' : 'a'}
							href={resolve('/sheet/[id]', { id: sheet.id })}
							class={{
								'flex flex-1 items-center gap-2 rounded-sm bg-zinc-200 px-4 dark:bg-zinc-800': true,
								' hover:bg-zinc-300 dark:hover:bg-zinc-700': !renaming,
							}}
						>
							{#if renaming_id === sheet.id}
								<input
									class="flex-1 bg-transparent py-4 font-medium outline-none"
									value={sheet.name}
									id="rename-{sheet.id}"
									onblur={(ev) => {
										renaming_id = null;
										sheet.name = ev.currentTarget.value;
										update_sheet_details({
											id: sheet.id,
											name: ev.currentTarget.value,
										}).updates(list_sheets());
									}}
									onkeydown={(ev) => {
										if (ev.key === 'Escape') {
											renaming_id = null;
										} else if (ev.key === 'Enter') {
											renaming_id = null;
											sheet.name = ev.currentTarget.value;
											update_sheet_details({
												id: sheet.id,
												name: ev.currentTarget.value,
											}).updates(list_sheets());
										}
									}}
								/>
							{:else}
								<span class="flex-1 truncate py-4 font-medium"
									>{sheet.name}</span
								>
							{/if}
							<span>
								{#if sheet.opened_at}
									{new Date(sheet.opened_at).toLocaleString()}
								{:else}
									<span class="text-neutral-500">Not Opened</span>
								{/if}
							</span>
						</svelte:element>
						<SheetMenu onrenameclick={start_renaming} {sheet} />
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</section>

{#if ImportDialog}
	<ImportDialog bind:this={dialog} />
{/if}

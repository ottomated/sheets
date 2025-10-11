<script lang="ts">
	import { page } from '$app/state';
	import { create_shared_link, delete_shared_link } from '$lib/sharing.remote';
	import { get_shared_links } from '$lib/sheet.remote';
	import { ClipboardCheck, Link, Share2, Trash2 } from '@o7/icon';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	const {
		sheet_id,
	}: {
		sheet_id: string;
	} = $props();

	const shared_links = $derived(get_shared_links(sheet_id));

	let dialog: HTMLDialogElement;

	const copied = new SvelteSet<string>();

	let now = $state(Date.now());
	onMount(() => {
		const i = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => {
			clearInterval(i);
		};
	});
</script>

<button
	onclick={() => dialog.showModal()}
	class="ml-auto rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
>
	<Share2 />
</button>

<dialog
	class="bg-transparent backdrop:bg-black/30 dark:backdrop:bg-black/70"
	bind:this={dialog}
	onclick={(ev) => {
		if (ev.currentTarget === ev.target) dialog.close();
	}}
>
	<div
		class="w-[500px] max-w-full rounded-md bg-zinc-300 p-4 text-black dark:bg-zinc-800 dark:text-white"
	>
		<h1 class="text-center text-lg font-bold">Sharing</h1>
		<div
			class="grid grid-cols-[1fr,1fr,max-content,max-content,max-content] items-center gap-x-4 gap-y-1"
		>
			<div class="border-b border-zinc-800 text-center dark:border-zinc-200">
				Created
			</div>
			<div class="border-b border-zinc-800 text-center dark:border-zinc-200">
				Expires
			</div>
			<div class="border-b border-zinc-800 text-center dark:border-zinc-200">
				Access
			</div>
			<div class="col-span-2"></div>
			{#each shared_links.current as link (link.id)}
				{@const expired =
					link.expires_at && new Date(link.expires_at).getTime() < now}
				<div class="text-xs">
					{new Date(link.created_at).toLocaleString()}
				</div>
				<div
					class={{
						'text-center': true,
						'text-xs': !expired && link.expires_at,
						'font-bold text-yellow-700 dark:text-yellow-500': expired,
					}}
				>
					{expired
						? 'EXPIRED'
						: link.expires_at
							? new Date(link.expires_at).toLocaleString()
							: 'Never'}
				</div>
				<div class="text-center text-sm font-bold uppercase tracking-wider">
					{link.access_type}
				</div>
				<button
					class="rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
					onclick={async () => {
						await navigator.clipboard.writeText(
							page.url.origin + '/shared-sheet/' + link.id,
						);
						copied.add(link.id);
						setTimeout(() => copied.delete(link.id), 1000);
					}}
				>
					{#if copied.has(link.id)}
						<ClipboardCheck size={16} />
					{:else}
						<Link size={16} />
					{/if}
				</button>
				<button
					class="rounded-full p-1 text-red-500 hover:bg-black/10 dark:hover:bg-white/10"
					onclick={async () => {
						await delete_shared_link({ link_id: link.id, sheet_id: sheet_id });
					}}
				>
					<Trash2 size={16} />
				</button>
			{:else}
				<div class="col-span-4 text-center text-lg opacity-70">
					No Shared Links
				</div>
			{/each}
		</div>
		<hr class="my-4" />
		<form {...create_shared_link} class="py-2">
			<h2 class="text-lg font-bold">Create Shared Link</h2>
			<input {...create_shared_link.fields.sheet_id.as('hidden', sheet_id)} />
			<div class="flex items-start gap-4">
				<label>
					<p class="mb-0.5 text-sm">Access Type</p>
					<select
						class="rounded-sm border border-zinc-400 bg-transparent px-2 py-1 outline-none ring-zinc-400 focus-visible:ring-1"
						{...create_shared_link.fields.access_type.as('select')}
					>
						<option value="read">Read</option>
						<option value="write">Write</option>
					</select>
					{#each create_shared_link.fields.access_type.issues() as issue}
						<p class="text-red-500">{issue.message}</p>
					{/each}
				</label>
				<label>
					<p class="mb-0.5 text-sm">Expiration</p>
					<select
						class="rounded-sm border border-zinc-400 bg-transparent px-2 py-1 outline-none ring-zinc-400 focus-visible:ring-1"
						{...create_shared_link.fields.duration_seconds.as('select')}
					>
						<option value="3600">1 Hour</option>
						<option value="86400">1 Day</option>
						<option value="604800">1 Week</option>
						<option value="2592000">1 Month</option>
						<option value="0">Never</option>
						<option value="30">Never</option>
					</select>
				</label>
			</div>
			{#each create_shared_link.fields.duration_seconds.issues() as issue}
				<p class="text-red-500">{issue.message}</p>
			{/each}
			<button
				class="mt-2 rounded-full bg-green-400 px-3 py-1 text-green-950 hover:bg-green-500 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
				>Create Link</button
			>
		</form>
		<form method="dialog" class="mt-4 flex justify-between gap-2">
			<button
				class="mt-4 rounded-full bg-zinc-400 px-3 py-1 text-zinc-700 hover:bg-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
				>Cancel</button
			>
			<button
				class="mt-4 rounded-full bg-green-400 px-3 py-1 text-green-950 hover:bg-green-500 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
				>Done</button
			>
		</form>
	</div>
</dialog>

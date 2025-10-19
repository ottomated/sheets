<script lang="ts">
	import {
		list_sheets,
		permanently_delete_sheet,
		update_sheet_details,
	} from '$lib/sheet.remote';
	import { ArchiveRestore, EllipsisVertical, Pencil, Trash2 } from '@o7/icon';

	const {
		sheet,
		onrenameclick,
	}: {
		sheet: Awaited<ReturnType<typeof list_sheets>>[number];
		onrenameclick: (id: string) => void;
	} = $props();

	const item_class =
		'flex items-center gap-2 w-full whitespace-nowrap px-4 py-2 text-lg hover:bg-black/10 dark:hover:bg-white/10';
</script>

<details class="relative">
	<summary
		class="block cursor-pointer rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
	>
		<EllipsisVertical />
	</summary>
	<ul
		class="absolute right-0 top-1/2 z-10 rounded-md bg-zinc-300 py-2 dark:bg-zinc-700 [&_li]:w-full"
	>
		<li>
			<button onclick={() => onrenameclick(sheet.id)} class={item_class}>
				<Pencil />
				Rename
			</button>
		</li>
		<li>
			{#if sheet.deleted_at}
				<button
					onclick={() => {
						update_sheet_details({
							id: sheet.id,
							deleted: false,
						}).updates(list_sheets());
					}}
					class={item_class}
				>
					<ArchiveRestore />
					Restore from Trash
				</button>
			{/if}
		</li>
		<li>
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
				class={item_class}
			>
				<Trash2 />
				{#if sheet.deleted_at}Permanently{/if}
				Delete
			</button>
		</li>
	</ul>
</details>

<script lang="ts">
	import type { IWorkbookData } from '@univerjs/core';
	import { parse_xlsx } from '$lib/import';
	import { univer } from '$lib/univer.svelte';
	import { import_sheet } from '$lib/sheet.remote';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	export function show() {
		dialog.showModal();
	}
	let dialog: HTMLDialogElement;
</script>

<dialog
	bind:this={dialog}
	class="bg-transparent backdrop:bg-black/30 dark:backdrop:bg-black/70"
>
	<form
		method="dialog"
		class="w-96 max-w-full rounded-md p-4 text-white dark:bg-zinc-800"
	>
		<input
			type="file"
			multiple
			accept=".xlsx,.xls"
			onchange={async (ev) => {
				const file = ev.currentTarget.files?.[0];
				if (!file) return;

				const workbook = await parse_xlsx(file);
				console.log(workbook);
				await import_sheet(JSON.stringify(workbook));
				await goto(resolve('/sheet/[id]', { id: workbook.id }));
			}}
		/>
		<button>Close</button>
	</form>
</dialog>

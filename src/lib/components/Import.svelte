<script lang="ts">
	import type { IWorkbookData } from '@univerjs/core';
	import { read } from 'xlsx';
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
				const data = await file.arrayBuffer();
				const workbook = read(data);
				const new_sheet: IWorkbookData = {
					name: file.name.substring(0, file.name.lastIndexOf('.')),
				};
				console.log(new_sheet);
			}}
		/>
		<button>Close</button>
	</form>
</dialog>

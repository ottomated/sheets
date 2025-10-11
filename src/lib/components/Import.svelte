<script lang="ts">
	import { resolve } from '$app/paths';
	import { parse_xlsx } from '$lib/import';
	import { import_sheet, list_sheets } from '$lib/sheet.remote';
	import { CircleCheck, CircleX, CloudUpload, LoaderCircle } from '@o7/icon';
	export function show() {
		dialog.showModal();
	}
	let dialog: HTMLDialogElement;

	function get_valid_files(
		files: DataTransferItemList | null | undefined,
	): Array<DataTransferItem> {
		if (!files) return [];
		return Array.from(files).filter(
			(file) =>
				file.kind === 'file' &&
				file.type ===
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
	}

	let files = $state<
		Array<
			| {
					file: File;
					status: 'idle' | 'importing';
					error?: never;
					workbook?: never;
			  }
			| {
					file: File;
					status: 'error';
					error: string;
					workbook?: never;
			  }
			| {
					file: File;
					status: 'success' | 'uploading' | 'uploaded';
					error?: never;
					workbook: Awaited<ReturnType<typeof parse_xlsx>>;
			  }
		>
	>([]);
	let hovering = $state(false);

	async function start_import() {
		for (const file of files) {
			file.status = 'importing';
			try {
				file.workbook = await parse_xlsx(file.file);
				file.status = 'success';
			} catch (err) {
				file.status = 'error';
				file.error = String(err);
				console.error(err);
			}
		}
		for (const file of files) {
			if ((file as any).status !== 'success') continue;
			try {
				file.status = 'uploading';
				await import_sheet(JSON.stringify(file.workbook));
				file.status = 'uploaded';
			} catch (err) {
				console.error(err);
				file.status = 'error';
				file.error = String(err);
			}
		}
		await list_sheets().refresh();
	}

	const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
	const thresh = 1024;
	function human_file_size(bytes: number, decimal = 1) {
		if (Math.abs(bytes) < thresh) {
			return bytes + ' B';
		}

		let u = -1;
		const r = 10 ** decimal;

		do {
			bytes /= thresh;
			++u;
		} while (
			Math.round(Math.abs(bytes) * r) / r >= thresh &&
			u < units.length - 1
		);

		return bytes.toFixed(decimal) + ' ' + units[u];
	}
</script>

<svelte:window
	ondrop={(ev) => {
		const valid = get_valid_files(ev.dataTransfer?.items);
		if (valid.length) {
			ev.preventDefault();
		}
	}}
/>

<dialog
	onclose={() => (files = [])}
	bind:this={dialog}
	class="bg-transparent backdrop:bg-black/30 dark:backdrop:bg-black/70"
>
	<form
		method="dialog"
		class="w-[500px] max-w-full rounded-md bg-zinc-300 p-4 text-black dark:bg-zinc-800 dark:text-white"
	>
		{#if !files.length}
			<h1 class="mb-2 text-center text-lg font-bold">Upload Files</h1>
			<label
				class="mx-auto block w-64 max-w-full"
				ondragover={(ev) => {
					ev.preventDefault();
					const valid = get_valid_files(ev.dataTransfer?.items);
					hovering = valid.length > 0;
				}}
				ondrop={(ev) => {
					hovering = false;
					files = get_valid_files(ev.dataTransfer?.items)
						.map((f) => ({
							file: f.getAsFile(),
							status: 'idle',
						}))
						.filter((f): f is (typeof files)[number] => f.file !== null);
					start_import();
				}}
				ondragleave={() => {
					hovering = false;
				}}
			>
				<div
					class={{
						'flex aspect-video cursor-pointer flex-col items-center justify-center border-2 border-dashed border-current text-zinc-600 hover:bg-zinc-600/10 dark:text-zinc-400 dark:hover:bg-zinc-400/10': true,
						'bg-zinc-600/10 dark:bg-zinc-400/10': hovering,
					}}
				>
					<svg
						class="size-10"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke-linecap="round"
					>
						<g class="transition-transform" class:-translate-y-px={hovering}>
							<path d="M12 3v12" /><path d="m8 11 4 4 4-4" />
						</g>
						<path
							d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"
						/>
					</svg>
					<p class="text-sm tracking-wider">Drop an .XLSX file here</p>
				</div>
				<input
					class="hidden"
					type="file"
					multiple
					accept=".xlsx"
					onchange={async (ev) => {
						files = Array.from(ev.currentTarget.files ?? []).map((f) => ({
							file: f,
							status: 'idle',
						}));
						start_import();
						// const file = ev.currentTarget.files?.[0];
						// if (!file) return;

						// const workbook = await parse_xlsx(file);
						// await import_sheet(JSON.stringify(workbook));
						// await goto(resolve('/sheet/[id]', { id: workbook.id }));
					}}
				/>
			</label>
		{:else}
			<h1 class="mb-2 text-center text-lg font-bold">Import</h1>

			<ul>
				{#each files as file}
					<li>
						{#if file.status === 'uploaded'}
							<a
								class="flex items-center gap-2 hover:underline"
								href={resolve('/sheet/[id]', { id: file.workbook.id })}
							>
								{@render list_item(file)}
							</a>
						{:else}
							<div class="flex items-center gap-2">
								{@render list_item(file)}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<div class="mt-4 flex justify-between gap-2">
			<button
				class="mt-4 rounded-full bg-zinc-400 px-2 py-0.5 text-zinc-700 hover:bg-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
				>Cancel</button
			>
			<button
				class="mt-4 rounded-full bg-green-400 px-2 py-0.5 text-green-700 hover:bg-green-500 dark:bg-green-700 dark:text-green-300 dark:hover:bg-green-600"
				>Done</button
			>
		</div>
	</form>
</dialog>
{#snippet list_item({ file, status, ...data }: (typeof files)[number])}
	<div class="flex-1">{file.name}</div>
	<div class="tabular-nums">{human_file_size(file.size)}</div>
	<div>
		{#if status === 'error'}
			<CircleX class="text-red-500" title={data.error} />
		{:else if status === 'uploaded'}
			<CircleCheck class="text-green-500" />
		{:else if status === 'importing'}
			<LoaderCircle class="animate-spin text-yellow-500" />
		{:else if status === 'uploading'}
			<CloudUpload class="text-yellow-500" />
		{/if}
	</div>
{/snippet}

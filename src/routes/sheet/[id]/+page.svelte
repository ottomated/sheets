<script lang="ts">
	import '@univerjs/preset-sheets-core/lib/index.css';
	import { onMount } from 'svelte';
	import { get_sheet } from '$lib/sheet.remote';
	import {
		createUniver,
		LocaleType,
		mergeLocales,
		type FUniver,
	} from '@univerjs/presets';
	import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
	import locale from '@univerjs/preset-sheets-core/locales/en-US';
	import '@univerjs/preset-sheets-core/lib/index.css';
	const { params } = $props();

	const sheet = $derived(await get_sheet(params.id));

	let container = $state<HTMLElement>();
	let api: FUniver;
	$effect(() => {
		if (!container) return;
		const { univer, univerAPI } = createUniver({
			locale: LocaleType.EN_US,
			locales: {
				[LocaleType.EN_US]: mergeLocales(locale),
			},
			presets: [
				UniverSheetsCorePreset({
					container,
				}),
			],
		});
		api = univerAPI;

		return () => {
			univer.dispose();
			univerAPI.dispose();
		};
	});

	const data = $derived(JSON.parse(sheet.data));
	$effect(() => {
		if (!container) return;
		api.createWorkbook(data);
	});
</script>

<main class="h-screen w-screen" bind:this={container}></main>

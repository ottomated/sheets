<script lang="ts">
	import { create_sheet, list_sheets } from '$lib/sheet.remote';

	const sheets = $derived(await list_sheets());
</script>

<svelte:window
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') {
			list_sheets().refresh();
		}
	}}
/>

<ul>
	{#each sheets as sheet}
		<li>
			<a href="/sheet/{sheet.id}">{sheet.name}</a>
		</li>
	{/each}
</ul>

<form {...create_sheet}>
	<button>Create Sheet</button>
</form>

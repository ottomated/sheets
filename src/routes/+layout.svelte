<script lang="ts">
	import '$lib/components/Sheet.svelte';
	import '../app.css';

	const { children } = $props();
</script>

<main class="min-h-screen dark:bg-zinc-900 dark:text-white">
	{@render children()}
</main>

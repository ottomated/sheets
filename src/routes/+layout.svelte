<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/fira-code';
	import '$lib/components/Sheet.svelte';
	import '../app.css';
	import { setup_theme } from '$lib/components/ThemeToggle.svelte';

	setup_theme();
	const { children } = $props();
</script>

<main class="min-h-screen dark:bg-zinc-900 dark:text-white">
	{@render children()}
</main>

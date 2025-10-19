<script lang="ts">
	import type { RouteId } from '$app/types';
	import type { Snippet } from 'svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	const { children, href }: { children: Snippet; href?: RouteId } = $props();
</script>

<nav class="flex h-16 items-center gap-2 px-4">
	{#if href}
		<a {href}>
			<img src="/icon.svg" alt="Sheets" class="size-8" />
		</a>
	{:else}
		<img src="/icon.svg" alt="Sheets" class="size-8" />
	{/if}
	{@render children?.()}
	<ThemeToggle />
</nav>

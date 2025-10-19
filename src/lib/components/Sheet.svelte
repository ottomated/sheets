<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { univer } from '$lib/fortune.svelte';

	const {
		sheet,
		save_fn,
		ondirty,
		onsaveerror,
		readonly,
		...props
	}: {
		sheet: {
			id: string;
			data: string;
			updated_at: string;
		};
		save_fn: (
			data: string,
			base: string,
		) => Promise<{ base?: string; error?: string }>;
		readonly?: boolean;
		ondirty?: (dirty: boolean) => void;
		onsaveerror?: (error: string) => void;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class:readonly {...props} {@attach univer.attachment}></div>

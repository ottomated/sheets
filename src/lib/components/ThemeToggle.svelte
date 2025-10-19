<script lang="ts" module>
	// import { univer } from '$lib/fortune.svelte';
	import { Moon, Sun } from '@o7/icon';
	import { createContext } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	class Theme {
		#system_theme = new MediaQuery('(prefers-color-scheme: dark)', true);
		#user_theme = $state<'light' | 'dark' | undefined>(undefined);
		loaded = $state(false);

		get theme() {
			return (
				this.#user_theme ?? (this.#system_theme.current ? 'dark' : 'light')
			);
		}

		set theme(value: 'light' | 'dark') {
			if ('startViewTransition' in document) {
				document.startViewTransition(() => {
					this.#user_theme = value;
				});
			} else {
				this.#user_theme = value;
			}
			if (value) {
				localStorage.theme = value;
			} else {
				localStorage.removeItem('theme');
			}
		}

		constructor() {
			$effect(() => {
				this.#user_theme = localStorage.theme;
				this.loaded = true;
			});
			$effect(() => {
				const is_dark = this.theme === 'dark';
				document.documentElement.classList.toggle('dark', is_dark);
				// univer.api?.toggleDarkMode(is_dark);
			});
		}
	}
	const [get_theme, set_theme] = createContext<Theme>();

	export { get_theme };
	export function setup_theme() {
		set_theme(new Theme());
	}
</script>

<script lang="ts">
	const theme = get_theme();
</script>

<button
	class:opacity-0={!theme.loaded}
	onclick={() => {
		theme.theme = theme.theme === 'light' ? 'dark' : 'light';
	}}
>
	{#if theme.theme === 'light'}
		<Moon />
	{:else}
		<Sun />
	{/if}
</button>

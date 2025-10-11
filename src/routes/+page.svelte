<script lang="ts">
	import { login } from '$lib/auth.remote';
	const { data } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center">
	<form {...login} class="flex flex-col gap-2 bg-zinc-200 p-4 dark:bg-zinc-950">
		<h1 class="text-center text-lg font-bold">
			{data.register ? 'Create Admin User' : 'Login'}
		</h1>
		<label>
			<p>Username</p>
			<input
				class="rounded-sm border border-zinc-400 bg-transparent px-2 py-1 outline-none ring-zinc-400 focus-visible:ring-1"
				{...login.fields.username.as('text')}
			/>
		</label>
		{#each login.fields.username.issues() as issue}
			<p class="text-red-500">{issue.message}</p>
		{/each}
		<label>
			<p>Password</p>
			<input
				class="rounded-sm border border-zinc-400 bg-transparent px-2 py-1 outline-none ring-zinc-400 focus-visible:ring-1"
				{...login.fields.password.as('password')}
			/>
		</label>
		{#each login.fields.password.issues() as issue}
			<p class="text-red-500">{issue.message}</p>
		{/each}
		<button>Log In</button>
	</form>
</div>

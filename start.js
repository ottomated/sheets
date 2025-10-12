import { spawnSync } from 'node:child_process';
spawnSync('node_modules/.bin/prisma', ['db', 'push'], {
	env: {
		DATABASE_URL: 'file:/data/data.db',
	},
}).stdout.toString();

await import('./build/index.js');

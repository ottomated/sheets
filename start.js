/* global process */
import { spawnSync } from 'node:child_process';

console.log('Migrating database...');
const res = spawnSync('node_modules/.bin/prisma', ['db', 'push'], {
	env: {
		DATABASE_URL: 'file:/data/data.db',
	},
});
if (res.status === 0) {
	console.log('Migration successful');
} else {
	console.error('Migration failed:');
	process.stderr.write(res.stderr);
	process.exit(res.status);
}

await import('./build/index.js');

import { Kysely, type RawBuilder, sql, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { DB } from './schema';
import { building } from '$app/environment';
import { DATA_DIR } from '$env/static/private';

export const sqlite = new Database(
	building ? ':memory:' : `${DATA_DIR}/data.db`,
);

export const db = new Kysely<DB>({
	dialect: new SqliteDialect({
		database: sqlite,
	}),
});

export function json<T>(obj: T): RawBuilder<T> {
	return sql`${JSON.stringify(obj)}`;
}

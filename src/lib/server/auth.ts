import {
	encodeBase32LowerCaseNoPadding,
	encodeHexLowerCase,
} from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';
import { db } from '$lib/db';

const ONE_DAY = 1000 * 60 * 60 * 24;

export function generate_session_token(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export async function create_session(
	token: string,
	user_id: string,
): Promise<Session> {
	const session_id = encodeHexLowerCase(
		sha256(new TextEncoder().encode(token)),
	);
	const session: Session = {
		id: session_id,
		user_id,
		expires_at: new Date(Date.now() + ONE_DAY * 60),
	};
	await db
		.insertInto('Session')
		.values({
			id: session.id,
			user_id: session.user_id,
			expires_at: Math.floor(session.expires_at.getTime() / 1000),
		})
		.execute();
	return session;
}

export async function validate_session_token(
	token: string,
): Promise<SessionValidationResult> {
	const session_id = encodeHexLowerCase(
		sha256(new TextEncoder().encode(token)),
	);
	const row = await db
		.selectFrom('Session as s')
		.innerJoin('User as u', 'u.id', 's.user_id')
		.select(['s.id', 's.user_id', 's.expires_at', 'u.username'])
		.where('s.id', '=', session_id)
		.executeTakeFirst();
	if (!row) {
		return { session: null, user: null };
	}
	const session: Session = {
		id: row.id,
		user_id: row.user_id,
		expires_at: new Date(row.expires_at * 1000),
	};
	if (Date.now() >= session.expires_at.getTime()) {
		await db.deleteFrom('Session').where('id', '=', session.id).execute();
		return { session: null, user: null };
	}
	const user: User = {
		id: row.user_id,
		username: row.username,
	};
	if (Date.now() >= session.expires_at.getTime() - ONE_DAY * 15) {
		session.expires_at = new Date(Date.now() + ONE_DAY * 30);
		await db
			.updateTable('Session')
			.set({
				expires_at: Math.floor(session.expires_at.getTime() / 1000),
			})
			.where('id', '=', session.id)
			.execute();
	}
	return { session, user };
}

export async function invalidate_session(session_id: string): Promise<void> {
	await db.deleteFrom('Session').where('id', '=', session_id).execute();
}

export type SessionValidationResult =
	| { session: Session; user: User }
	| { session: null; user: null };

export interface Session {
	id: string;
	user_id: string;
	expires_at: Date;
}

export interface User {
	id: string;
	username: string;
}

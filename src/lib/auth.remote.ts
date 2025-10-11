import { form, getRequestEvent } from '$app/server';
import z from 'zod';
import { db } from './db';
import { redirect } from '@sveltejs/kit';
import { hash, verify } from '@node-rs/argon2';
import { create_session, generate_session_token } from './server/auth';
import { dev } from '$app/environment';
import { resolve } from '$app/paths';
import { nanoid } from 'nanoid';

export const login = form(
	z.object({
		username: z.string().min(1),
		password: z.string().min(8).max(255),
	}),
	async ({ username, password }, invalid) => {
		const { cookies, locals } = getRequestEvent();
		if (locals.setting_up) {
			const existing = await db
				.selectFrom('User')
				.select(['id'])
				.where('username', '=', username)
				.executeTakeFirst();
			if (existing) return invalid(invalid.username('Username already exists'));
			const password_hash = await hash(password, {
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1,
			});
			const { id } = await db
				.insertInto('User')
				.values({
					id: nanoid(),
					username,
					password: password_hash,
					created_at: new Date().toISOString(),
				})
				.returning('id as id')
				.executeTakeFirstOrThrow();

			const token = generate_session_token();
			const session = await create_session(token, id);

			cookies.set('session', token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				expires: session.expires_at,
				secure: !dev,
			});
			redirect(303, resolve('/sheets'));
		}
		const user = await db
			.selectFrom('User')
			.select(['id', 'password'])
			.where('username', '=', username)
			.executeTakeFirst();
		if (!user) return invalid(invalid.username('Invalid username'));

		const password_valid = await verify(user.password, password);
		if (!password_valid) return invalid(invalid.password('Invalid password'));
		const token = generate_session_token();
		const session = await create_session(token, user.id);

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			expires: session.expires_at,
			secure: !dev,
		});
		redirect(303, resolve('/sheets'));
	},
);

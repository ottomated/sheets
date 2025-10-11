import { dev } from '$app/environment';
import { db } from '$lib/db';
import { validate_session_token } from '$lib/server/auth';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const session_token = event.cookies.get('session');
	if (!session_token) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = await validate_session_token(session_token);
		if (session) {
			event.cookies.set('session', session_token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				expires: session.expires_at,
				secure: !dev,
			});
		} else {
			event.cookies.delete('session', {
				path: '/',
			});
		}

		event.locals.user = user;
		event.locals.session = session;
	}
	if (event.locals.user === null) {
		const user = await db.selectFrom('User').select('id').executeTakeFirst();
		event.locals.setting_up = !user;
		if (event.route.id !== '/') {
			redirect(307, '/');
		}
	}
	return await resolve(event);
};

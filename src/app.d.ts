declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').User | null;
			session: import('$lib/server/auth').Session | null;
			setting_up?: boolean;
		}
	}
}

export {};

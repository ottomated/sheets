// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'selector',
	theme: {
		fontFamily: {
			sans: ['Inter Variable', ...defaultTheme.fontFamily.sans],
		},
	},
	plugins: [],
};

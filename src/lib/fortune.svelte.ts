import { browser } from '$app/environment';

type Instance = {
	attachment: (node: HTMLElement) => void;
	api: FUniver;
};

let instance = $state<Instance>();

export const univer = {
	get api() {
		return instance?.api;
	},
	get attachment() {
		return instance?.attachment;
	},
};

if (browser) {
	const permission_error = "You don't have permission to edit this sheet.";
	const container = document.createElement('div');
	container.className = 'w-full h-full';

	Promise.all([
		import('@fileverse-dev/fortune-react'),
		import('react-dom/client'),
		import('react'),
	]).then(([{ Workbook }, { createRoot }, react]) => {
		createRoot(container).render(
			react.createElement(Workbook, {
				data: [{ name: 'Sheet1' }],
			}),
		);
		instance = {
			attachment: (node) => {
				node.appendChild(container);
			},
			// api: univerAPI,
		};
	});
}

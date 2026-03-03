import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/api': 'http://localhost:7777',
			'/ws': {
				target: 'ws://localhost:7777',
				ws: true
			}
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'jsdom',
		setupFiles: ['src/test-setup.ts'],
		alias: {
			'$lib': '/src/lib',
			'$lib/*': '/src/lib/*'
		},
		server: {
			deps: {
				inline: [/svelte/]
			}
		}
	},
	resolve: {
		conditions: ['browser']
	}
});

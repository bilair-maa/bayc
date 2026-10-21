// Calls Wix's REST API with the site's admin API key (BAYC_ADMIN_API_KEY):
// read-only access to CMS drafts and member badges, used only after the
// caller is confirmed to be an Admin. Server-only; the key never reaches the browser.
import { BAYC_ADMIN_API_KEY } from 'astro:env/server';
import wixConfig from '../../wix.config.json';

const apiBase = 'https://www.wixapis.com';
const requestTimeoutMs = 10_000;

export function adminApiConfigured(): boolean {
	return BAYC_ADMIN_API_KEY !== undefined && BAYC_ADMIN_API_KEY.trim() !== '';
}

export async function adminApiPost(path: string, body: unknown): Promise<unknown> {
	if (!BAYC_ADMIN_API_KEY) throw new Error('BAYC_ADMIN_API_KEY is not set.');
	const response = await fetch(`${apiBase}${path}`, {
		method: 'POST',
		headers: {
			Authorization: BAYC_ADMIN_API_KEY,
			'wix-site-id': wixConfig.siteId,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(requestTimeoutMs),
	});
	if (!response.ok) {
		// The response body can echo request details, so only the status is kept.
		throw new Error(`Wix API ${path} failed with status ${response.status}.`);
	}
	return response.json();
}

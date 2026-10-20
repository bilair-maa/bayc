import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { isFormName, validateForm } from '../../../data/formFields';
import { submissionFieldErrors, submitForm } from '../../../data/forms';
import { site } from '../../../data/site';

export const prerender = false;
const maxBodyBytes = 16 * 1024;
const fallback = 'Please try again or email ' + site.email + '.';

function json(body: object, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
		},
	});
}

async function readBody(request: Request): Promise<string | undefined> {
	const reader = request.body?.getReader();
	if (!reader) return undefined;
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBodyBytes) {
				await reader.cancel();
				return undefined;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export const POST: APIRoute = async ({ request, params, url }) => {
	const form = params.form;
	if (!isFormName(form)) return json({ error: 'Form not found.' }, 404);
	if (request.headers.get('origin') !== url.origin)
		return json({ error: 'Submit this form from our website.' }, 403);
	if (
		request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
		'application/json'
	) {
		return json({ error: 'Send this form as JSON.' }, 415);
	}
	const length = request.headers.get('content-length');
	if (
		length !== null &&
		(!/^\d+$/.test(length) || Number(length) > maxBodyBytes)
	) {
		return json({ error: 'This submission is too large.' }, 413);
	}
	let body: unknown;
	try {
		const text = await readBody(request);
		if (text === undefined)
			return json({ error: 'This submission is too large.' }, 413);
		body = JSON.parse(text);
	} catch {
		return json({ error: 'Please check your submission.' }, 400);
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body))
		return json({ error: 'Please check your submission.' }, 400);
	const input = Object.fromEntries(Object.entries(body));
	if (
		typeof input.bayc_reference_code !== 'string' ||
		input.bayc_reference_code.length > 200
	) {
		return json({ error: 'Please check your submission.' }, 400);
	}
	if (input.bayc_reference_code !== '') return json({ ok: true });
	if (
		typeof input.started_at !== 'number' ||
		!Number.isFinite(input.started_at) ||
		Date.now() - input.started_at < 2000
	) {
		return json(
			{ error: 'Please take a moment to review the form, then try again.' },
			400,
		);
	}
	const { values, fieldErrors } = validateForm(form, input);
	if (Object.keys(fieldErrors).length) return json({ fieldErrors }, 400);
	try {
		if (import.meta.env.PUBLIC_RECAPTCHA_ENABLED === 'true') {
			if (
				typeof input.captcha_token !== 'string' ||
				input.captcha_token.length < 1 ||
				input.captcha_token.length > 3000
			) {
				return json(
					{ error: 'The spam check could not be completed. ' + fallback },
					400,
				);
			}
			const secret = getSecret('RECAPTCHA_SECRET_KEY');
			if (!secret)
				return json(
					{
						error:
							'Online submissions are temporarily unavailable. Email ' +
							site.email +
							'.',
					},
					503,
				);

			const response = await fetch(
				'https://www.google.com/recaptcha/api/siteverify',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({ secret, response: input.captcha_token }),
					signal: AbortSignal.timeout(5000),
				},
			);
			if (!response.ok)
				return json(
					{ error: 'The spam check is unavailable. ' + fallback },
					502,
				);
			const result: unknown = await response.json();
			if (typeof result !== 'object' || result === null)
				return json(
					{ error: 'The spam check is unavailable. ' + fallback },
					502,
				);
			const captcha = Object.fromEntries(Object.entries(result));
			if (
				captcha.success !== true ||
				typeof captcha.score !== 'number' ||
				captcha.score < 0.5 ||
				captcha.action !== 'bayc_' + form ||
				captcha.hostname !== url.hostname ||
				typeof captcha.challenge_ts !== 'string' ||
				!Number.isFinite(Date.parse(captcha.challenge_ts)) ||
				Date.now() - Date.parse(captcha.challenge_ts) > 120000 ||
				Date.parse(captcha.challenge_ts) > Date.now() + 10000
			) {
				return json(
					{
						error:
							'The spam check could not verify this submission. ' + fallback,
					},
					403,
				);
			}
		}
		await submitForm(form, values);
		return json({ ok: true });
	} catch (error) {
		const fieldErrors = submissionFieldErrors(form, error);
		return Object.keys(fieldErrors).length
			? json({ fieldErrors }, 400)
			: json(
					{ error: 'We could not confirm your submission. ' + fallback },
					502,
				);
	}
};

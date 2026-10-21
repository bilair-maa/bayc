import {
	formFields,
	isFormName,
	validateForm,
	type FieldErrors,
	type FormName,
} from '../data/formFields';
import { site } from '../data/site';

interface Recaptcha {
	ready(callback: () => void): void;
	execute(key: string, options: { action: string }): Promise<string>;
}
declare global {
	interface Window {
		grecaptcha?: Recaptcha;
	}
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(
			() => reject(new Error('Spam check timed out.')),
			milliseconds,
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function initializeForms(): void {
	// Shared only within this page initialization, so multiple forms load one script.
	let captchaScript: Promise<Recaptcha> | undefined;
	function loadCaptcha(key: string): Promise<Recaptcha> {
		if (captchaScript) return captchaScript;
		captchaScript = new Promise<Recaptcha>((resolve, reject) => {
			const script = document.createElement('script');
			script.src =
				'https://www.google.com/recaptcha/api.js?render=' +
				encodeURIComponent(key);
			script.async = true;
			script.addEventListener(
				'load',
				() => {
					const captcha = window.grecaptcha;
					if (!captcha) {
						reject(new Error('Spam check unavailable.'));
						return;
					}
					captcha.ready(() => resolve(captcha));
				},
				{ once: true },
			);
			script.addEventListener(
				'error',
				() => reject(new Error('Spam check unavailable.')),
				{ once: true },
			);
			document.head.append(script);
		});
		return captchaScript;
	}
	for (const form of document.querySelectorAll<HTMLFormElement>(
		'form[data-form]',
	)) {
		const name = form.dataset.form;
		if (!isFormName(name) || form.dataset.initialized) continue;
		form.dataset.initialized = 'true';
		setupForm(form, name, loadCaptcha);
	}
}

function setupForm(
	form: HTMLFormElement,
	name: FormName,
	loadCaptcha: (key: string) => Promise<Recaptcha>,
): void {
	const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	const status = form.querySelector<HTMLElement>('[data-form-status]');
	const siteKey = form.querySelector<HTMLInputElement>(
		'[name="captcha_site_key"]',
	)?.value;
	if (!button || !status) return;
	const captchaEnabled =
		form.querySelector<HTMLInputElement>('[name="captcha_enabled"]')?.value ===
		'true';
	if (captchaEnabled && !siteKey) {
		status.textContent =
			'Online submissions are temporarily unavailable. Email ' +
			site.email +
			'.';
		return;
	}
	const initialLabel = button.textContent ?? 'Submit';
	const fields = formFields[name];
	const errors: FieldErrors = {};
	let sending = false;
	const fallback = 'Please try again or email ' + site.email + '.';
	const controls = (key: string) =>
		Array.from(
			form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]'),
		).filter((control) => control.name === key);
	function values(): Record<string, unknown> {
		const data = new FormData(form);
		const values: Record<string, unknown> = {};
		for (const [key, rule] of Object.entries(fields)) {
			values[key] =
				rule.kind === 'array'
					? data.getAll(key)
					: (data.get(key) ?? '');
		}
		return values;
	}
	function showError(key: string, message: string): void {
		errors[key] = message;
		const output = form.querySelector<HTMLElement>(
			'[data-error="' + key + '"]',
		);
		if (output) output.textContent = message;
		const first = controls(key)[0];
		const target =
			first?.type === 'radio' ||
			(first?.type === 'checkbox' && key === 'interests')
				? first.closest('fieldset')
				: first;
		if (message) target?.setAttribute('aria-invalid', 'true');
		else target?.removeAttribute('aria-invalid');
	}
	function showErrors(fieldErrors: FieldErrors): void {
		for (const key of Object.keys(fields))
			showError(key, fieldErrors[key] ?? '');
		const first = Object.keys(fields).find((key) => fieldErrors[key]);
		if (first) controls(first)[0]?.focus();
	}
	form.noValidate = true;
	button.disabled = false;
	for (const key of Object.keys(fields)) {
		for (const control of controls(key)) {
			control.addEventListener('blur', () =>
				showError(key, validateForm(name, values()).fieldErrors[key] ?? ''),
			);
			control.addEventListener('input', () => {
				if (errors[key])
					showError(key, validateForm(name, values()).fieldErrors[key] ?? '');
			});
			control.addEventListener('change', () => {
				if (errors[key])
					showError(key, validateForm(name, values()).fieldErrors[key] ?? '');
			});
		}
	}
	const prepareCaptcha = () => {
		void withTimeout(loadCaptcha(siteKey ?? ''), 10000).catch(() => {
			status.textContent = 'The spam check could not load. ' + fallback;
		});
	};
	if (captchaEnabled) {
		form.addEventListener('focusin', prepareCaptcha, { once: true });
		form.addEventListener('pointerdown', prepareCaptcha, { once: true });
	}
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (sending) return;
		const parsed = validateForm(name, values());
		showErrors(parsed.fieldErrors);
		if (Object.keys(parsed.fieldErrors).length) {
			status.textContent = 'Please correct the highlighted fields.';
			return;
		}
		sending = true;
		button.disabled = true;
		button.textContent = 'Sending...';
		form.setAttribute('aria-busy', 'true');
		status.textContent = 'Sending your submission...';
		try {
			let token: string | undefined;
			if (captchaEnabled && siteKey) {
				const captcha = await withTimeout(loadCaptcha(siteKey), 10000);
				token = await withTimeout(
					captcha.execute(siteKey, { action: 'bayc_' + name }),
					10000,
				);
			}
			const response = await fetch('/api/forms/' + name, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...parsed.values,
					bayc_reference_code: new FormData(form).get('bayc_reference_code'),
					started_at: Number(new FormData(form).get('started_at')),
					captcha_token: token,
				}),
				signal: AbortSignal.timeout(25000),
			});
			const result: unknown = await response.json();
			if (typeof result !== 'object' || result === null)
				throw new Error('Unexpected response.');
			const body = Object.fromEntries(Object.entries(result));
			if (response.ok && body.ok === true) {
				const panel = document.createElement('div');
				panel.className = form.className;
				for (const attribute of form.attributes) {
					if (attribute.name.startsWith('data-astro-cid-'))
						panel.setAttribute(attribute.name, attribute.value);
				}
				panel.setAttribute('role', 'status');
				const heading = document.createElement(
					name === 'contact' ? 'h2' : 'h3',
				);
				for (const attribute of panel.attributes) {
					if (attribute.name.startsWith('data-astro-cid-'))
						heading.setAttribute(attribute.name, attribute.value);
				}
				heading.tabIndex = -1;
				heading.textContent = 'Thank you!';
				const message = document.createElement('p');
				message.textContent =
					name === 'newsletter'
						? 'Your sign-up has been received. Check your inbox for updates and any confirmation instructions.'
						: name === 'membership'
							? 'Your application has been received. We will be in touch.'
							: 'Your message has been received. We will be in touch.';
				panel.append(heading, message);
				form.replaceWith(panel);
				heading.focus();
				return;
			}
			if (
				typeof body.fieldErrors === 'object' &&
				body.fieldErrors !== null &&
				!Array.isArray(body.fieldErrors)
			) {
				const safeErrors: FieldErrors = {};
				for (const [key, value] of Object.entries(body.fieldErrors)) {
					if (Object.hasOwn(fields, key) && typeof value === 'string')
						safeErrors[key] = value;
				}
				showErrors(safeErrors);
				status.textContent = 'Please correct the highlighted fields.';
			} else {
				status.textContent =
					typeof body.error === 'string'
						? body.error
						: 'We could not confirm your submission. ' + fallback;
			}
		} catch {
			status.textContent = 'We could not confirm your submission. ' + fallback;
		} finally {
			sending = false;
			button.disabled = false;
			button.textContent = initialLabel;
			form.removeAttribute('aria-busy');
		}
	});
}

initializeForms();

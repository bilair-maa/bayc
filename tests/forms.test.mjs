import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
async function load(context, file, dependencies = {}) {
	const source = await readFile(new URL(file, root), 'utf8');
	const compiled = ts.transpileModule(source, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ES2022,
		},
	}).outputText;
	const module = new vm.SourceTextModule(compiled, {
		context,
		identifier: file,
		initializeImportMeta(meta) {
			meta.env = {
				PUBLIC_RECAPTCHA_ENABLED:
					context.captchaEnabled === false ? 'false' : 'true',
			};
		},
	});
	await module.link((specifier) => {
		if (!Object.hasOwn(dependencies, specifier))
			throw new Error('Unexpected import: ' + specifier);
		return dependencies[specifier];
	});
	await module.evaluate();
	return module;
}
function stub(context, exports) {
	return new vm.SyntheticModule(
		Object.keys(exports),
		function () {
			for (const [key, value] of Object.entries(exports))
				this.setExport(key, value);
		},
		{ context },
	);
}
async function fixture(options = {}) {
	const sent = [];
	let verificationCalls = 0;
	const context = vm.createContext({
		captchaEnabled: options.captchaEnabled,
		Response,
		Request,
		URL,
		URLSearchParams,
		TextDecoder,
		Uint8Array,
		AbortSignal,
		Date,
		fetch: async () => {
			verificationCalls++;
			if (options.networkError) throw new Error('Network unavailable');
			return Response.json(
				options.captcha ?? {
					success: true,
					score: 0.9,
					action: 'bayc_contact',
					hostname: 'baycusa.org',
					challenge_ts: new Date().toISOString(),
				},
			);
		},
	});
	const fields = await load(context, 'src/data/formFields.ts');
	const route = await load(context, 'src/pages/api/forms/[form].ts', {
		'astro:env/server': stub(context, {
			getSecret: () =>
				options.missingSecret ? undefined : 'synthetic-test-secret',
		}),
		'../../../data/formFields': fields,
		'../../../data/site': stub(context, {
			site: { email: 'test@example.com' },
		}),
		'../../../data/forms': stub(context, {
			submitForm: async (...args) => {
				if (options.submissionError) throw new Error('Internal failure');
				sent.push(args);
			},
			submissionFieldErrors: () => ({}),
		}),
	});
	const valid = {
		topic: 'general',
		name: 'Test Visitor',
		email: 'visitor@example.com',
		message: 'Test message',
		started_at: Date.now() - 3000,
		bayc_reference_code: '',
		captcha_token: 'synthetic-test-token',
	};
	async function post(body = valid, headers = {}, form = 'contact', raw) {
		const url = new URL('https://baycusa.org/api/forms/' + form);
		const request = new Request(url, {
			method: 'POST',
			headers: {
				origin: url.origin,
				'content-type': 'application/json',
				...headers,
			},
			body: raw ?? JSON.stringify(body),
		});
		return route.namespace.POST({ request, params: { form }, url });
	}
	return {
		post,
		sent,
		valid,
		get verificationCalls() {
			return verificationCalls;
		},
		validate: fields.namespace.validateForm,
	};
}

test('valid contact reaches the submission boundary once with only allowlisted, trimmed values', async () => {
	const f = await fixture();
	const response = await f.post({
		...f.valid,
		name: ' Test Visitor ',
		admin: true,
	});
	assert.equal(response.status, 200);
	assert.equal(f.sent.length, 1);
	assert.equal(f.sent[0][1].name, 'Test Visitor');
	assert.equal(Object.hasOwn(f.sent[0][1], 'admin'), false);
	assert.equal(Object.hasOwn(f.sent[0][1], 'captcha_token'), false);
});
test('required fields, invalid emails, length boundaries and choice types are validated', async () => {
	const f = await fixture();
	for (const [key, value] of [
		['name', ''],
		['email', 'invalid'],
		['message', 'x'.repeat(2001)],
		['topic', 'unknown'],
		['name', 123],
	]) {
		const response = await f.post({ ...f.valid, [key]: value });
		assert.equal(response.status, 400);
		assert.ok((await response.json()).fieldErrors[key]);
	}
	assert.equal(
		(
			await f.post({
				...f.valid,
				name: 'x'.repeat(100),
				message: 'x'.repeat(2000),
			})
		).status,
		200,
	);
});
test('membership validates interest checkbox arrays', async () => {
	const f = await fixture();
	const base = {
		first_name: 'Test',
		last_name: 'Visitor',
		email: 'test@example.com',
		role: 'student',
		interests: [],
	};
	assert.equal(
		Object.keys(f.validate('membership', base).fieldErrors).length,
		0,
	);
	for (const interests of [
		null,
		'mentorship',
		['invalid'],
		['mentorship', 'mentorship'],
		Array(6).fill('mentorship'),
		[123],
	]) {
		assert.ok(
			f.validate('membership', { ...base, interests }).fieldErrors.interests,
		);
	}
	assert.equal(
		Object.hasOwn(f.validate('membership', base).values, 'list_in_directory'),
		false,
	);
	assert.equal(
		Object.keys(
			f.validate('newsletter', { name: 'Test', email: 'test@example.com' })
				.fieldErrors,
		).length,
		0,
	);
});
test('honeypot returns success without sending; fast and forged future timestamps show an error', async () => {
	const f = await fixture();
	assert.equal(
		(await f.post({ ...f.valid, bayc_reference_code: 'bot' })).status,
		200,
	);
	for (const started_at of [Date.now(), Date.now() + 5000, 'invalid', null]) {
		assert.equal((await f.post({ ...f.valid, started_at })).status, 400);
	}
	assert.equal(f.sent.length, 0);
});
test('unknown forms, cross-origin requests, wrong media types, invalid JSON and oversized bodies fail', async () => {
	const f = await fixture();
	assert.equal((await f.post(f.valid, {}, 'unknown')).status, 404);
	assert.equal(
		(await f.post(f.valid, { origin: 'https://other.example' })).status,
		403,
	);
	assert.equal((await f.post(f.valid, { origin: 'null' })).status, 403);
	assert.equal(
		(await f.post(f.valid, { 'content-type': 'text/plain' })).status,
		415,
	);
	assert.equal((await f.post(f.valid, {}, 'contact', '{')).status, 400);
	assert.equal((await f.post(f.valid, {}, 'contact', 'null')).status, 400);
	assert.equal(
		(await f.post(f.valid, {}, 'contact', ' '.repeat(16385))).status,
		413,
	);
	assert.equal(
		(await f.post(f.valid, { 'content-length': '20000' })).status,
		413,
	);
	assert.equal(f.sent.length, 0);
});
test('missing, rejected, mismatched and stale CAPTCHA tokens cannot submit', async () => {
	const f = await fixture();
	assert.equal((await f.post({ ...f.valid, captcha_token: '' })).status, 400);
	const validCaptcha = {
		success: true,
		score: 0.9,
		hostname: 'baycusa.org',
		action: 'bayc_contact',
		challenge_ts: new Date().toISOString(),
	};
	for (const changes of [
		{ success: false },
		{ score: 0.1 },
		{ hostname: 'other.example' },
		{ action: 'bayc_newsletter' },
		{ challenge_ts: 'invalid' },
		{ challenge_ts: new Date(Date.now() - 180000).toISOString() },
	]) {
		const f = await fixture({ captcha: { ...validCaptcha, ...changes } });
		assert.equal((await f.post()).status, 403);
		assert.equal(f.sent.length, 0);
	}
});
test('missing configuration and downstream failures produce safe errors', async () => {
	for (const options of [
		{ missingSecret: true },
		{ networkError: true },
		{ submissionError: true },
	]) {
		const f = await fixture(options);
		const response = await f.post();
		assert.equal(response.status, options.missingSecret ? 503 : 502);
		const output = await response.text();
		assert.ok(output.includes('test@example.com'));
		assert.equal(output.includes('Internal failure'), false);
		assert.equal(output.includes('synthetic-test-secret'), false);
	}
});
test('Wix validation errors are safely mapped and newsletter consent is server-controlled', async () => {
	let captured;
	const context = vm.createContext({});
	const fields = await load(context, 'src/data/formFields.ts');
	const forms = await load(context, 'src/data/forms.ts', {
		'@wix/forms': stub(context, {
			submissions: {
				createSubmission: async (value) => {
					captured = value;
				},
			},
		}),
		'./formFields': fields,
	});
	const errors = forms.namespace.submissionFieldErrors('contact', {
		details: {
			validationError: {
				fieldViolations: [
					{
						data: {
							errors: [
								{
									errorPath: 'email',
									errorType: 'FORMAT_ERROR',
									errorMessage: 'private',
								},
								{ errorPath: 'unknown', errorType: 'TYPE_ERROR' },
							],
						},
					},
				],
			},
		},
	});
	assert.equal(errors.email, 'Please check Email.');
	assert.equal(Object.hasOwn(errors, 'unknown'), false);
	await forms.namespace.submitForm('newsletter', {
		name: 'Test',
		email: 'test@example.com',
	});
	assert.equal(captured.submissions.subscribe, true);
});

test('temporary mode accepts all three forms without CAPTCHA and keeps other safeguards', async () => {
	const f = await fixture({
		captchaEnabled: false,
		missingSecret: true,
		networkError: true,
	});
	const common = { started_at: Date.now() - 3000, bayc_reference_code: '' };
	for (const [form, values] of [
		[
			'contact',
			{
				topic: 'general',
				name: 'Test',
				email: 'test@example.com',
				message: 'Test',
			},
		],
		[
			'membership',
			{
				first_name: 'Test',
				last_name: 'Visitor',
				email: 'test@example.com',
				role: 'student',
				interests: ['mentorship'],
			},
		],
		['newsletter', { name: 'Test', email: 'test@example.com' }],
	]) {
		assert.equal(
			(await f.post({ ...common, ...values }, {}, form)).status,
			200,
		);
	}
	assert.equal(f.sent.length, 3);
	assert.equal(f.verificationCalls, 0);
	assert.equal((await f.post({ ...f.valid, email: 'invalid' })).status, 400);
	assert.equal(
		(await f.post({ ...f.valid, started_at: Date.now() + 1000 })).status,
		400,
	);
	assert.equal(
		(await f.post(f.valid, { origin: 'https://other.example' })).status,
		403,
	);
	assert.equal(
		(await f.post({ ...f.valid, bayc_reference_code: 'bot' })).status,
		200,
	);
	assert.equal(f.sent.length, 3);
});

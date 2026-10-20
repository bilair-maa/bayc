import { submissions } from '@wix/forms';
import {
	formFields,
	type FieldErrors,
	type FormName,
	type FormValues,
} from './formFields';

const formIds: Record<FormName, string> = {
	contact: 'ff3a7709-880c-4b81-9a27-4c14dd337da4',
	membership: '2ee4eee0-7d1a-4e93-af96-c32fc0840e64',
	newsletter: '186d1de5-9cf0-4ac1-b9c1-ffdae4c7823a',
};

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? Object.fromEntries(Object.entries(value))
		: undefined;
}

export function submissionFieldErrors(
	form: FormName,
	error: unknown,
): FieldErrors {
	const details = record(record(error)?.details);
	const violations = record(details?.validationError)?.fieldViolations;
	const fieldErrors: FieldErrors = {};
	if (!Array.isArray(violations)) return fieldErrors;
	for (const violation of violations) {
		const errors = record(record(violation)?.data)?.errors;
		if (!Array.isArray(errors)) continue;
		for (const error of errors) {
			const entry = record(error);
			if (typeof entry?.errorPath !== 'string') continue;
			const key = entry.errorPath.split('/')[0];
			if (!Object.hasOwn(formFields[form], key)) continue;
			const rule = formFields[form][key];
			if (!rule) continue;
			fieldErrors[key] =
				entry.errorType === 'REQUIRED_VALUE_ERROR'
					? rule.label + ' is required.'
					: 'Please check ' + rule.label + '.';
		}
	}
	return fieldErrors;
}

export async function submitForm(
	form: FormName,
	values: FormValues,
): Promise<void> {
	// Our v3 token is verified by Google in the route. It cannot be used as a
	// Wix-issued CAPTCHA token; Wix independently applies ADVANCED spam filtering.
	await submissions.createSubmission({
		formId: formIds[form],
		submissions:
			form === 'newsletter' ? { ...values, subscribe: true } : values,
	});
}

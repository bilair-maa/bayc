export const topics = [
	{ value: 'general', label: 'General', description: 'Questions about BAYC' },
	{
		value: 'membership',
		label: 'Membership',
		description: 'Joining or your application',
	},
	{
		value: 'mentorship',
		label: 'Mentorship Introduction',
		description: 'Connect with a member',
	},
	{
		value: 'partnership',
		label: 'Partnership',
		description: 'Organizations & institutions',
	},
	{ value: 'media', label: 'Media', description: 'Press and interviews' },
] as const;

export const roles = [
	{ value: 'student', label: 'Student' },
	{ value: 'young-professional', label: 'Young Professional' },
	{ value: 'community-member', label: 'Community Member' },
] as const;

export const interests = [
	{ value: 'leadership-development', label: 'Leadership Development' },
	{ value: 'mentorship', label: 'Mentorship' },
	{ value: 'civic-education', label: 'Civic Education' },
	{ value: 'community-service', label: 'Community Service' },
	{ value: 'heritage-culture', label: 'Heritage & Culture' },
] as const;

export type FormName = 'contact' | 'membership' | 'newsletter';
export type FormValues = Record<string, string | string[]>;
export type FieldErrors = Record<string, string>;
interface FieldRule {
	label: string;
	required?: boolean;
	maxLength?: number;
	format?: 'email';
	options?: readonly { value: string }[];
	kind?: 'array';
}

const name = { label: 'Name', required: true, maxLength: 100 };
const email = {
	label: 'Email',
	required: true,
	maxLength: 254,
	format: 'email',
} as const;
export const formFields: Record<FormName, Record<string, FieldRule>> = {
	contact: {
		topic: { label: 'Topic', required: true, options: topics },
		name,
		email,
		message: { label: 'Message', required: true, maxLength: 2000 },
	},
	membership: {
		first_name: { ...name, label: 'First Name' },
		last_name: { ...name, label: 'Last Name' },
		email,
		city: { label: 'City or Borough', maxLength: 100 },
		role: { label: 'I am a', required: true, options: roles },
		interests: { label: 'Interested In', kind: 'array', options: interests },
		message: { label: 'Why do you want to join?', maxLength: 2000 },
	},
	newsletter: { name, email },
};

export function isFormName(value: unknown): value is FormName {
	return (
		value === 'contact' || value === 'membership' || value === 'newsletter'
	);
}

export function validateForm(
	form: FormName,
	input: Record<string, unknown>,
): {
	values: FormValues;
	fieldErrors: FieldErrors;
} {
	const values: FormValues = {};
	const fieldErrors: FieldErrors = {};
	for (const [key, rule] of Object.entries(formFields[form])) {
		const raw = input[key];
		if (rule.kind === 'array') {
			const selected = raw === undefined ? [] : raw;
			if (
				!Array.isArray(selected) ||
				selected.length > (rule.options?.length ?? 0) ||
				selected.some(
					(value) =>
						typeof value !== 'string' ||
						!rule.options?.some((option) => option.value === value),
				) ||
				new Set(selected).size !== selected.length
			) {
				fieldErrors[key] = 'Choose from the listed options.';
			} else values[key] = selected;
			continue;
		}
		if (raw !== undefined && typeof raw !== 'string') {
			fieldErrors[key] = 'Please check this field.';
			continue;
		}
		const value = typeof raw === 'string' ? raw.trim() : '';
		values[key] = value;
		if (rule.required && !value)
			fieldErrors[key] = rule.label + ' is required.';
		else if (rule.maxLength && value.length > rule.maxLength)
			fieldErrors[key] =
				rule.label + ' must be at most ' + rule.maxLength + ' characters.';
		else if (
			value &&
			rule.format === 'email' &&
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
		)
			fieldErrors[key] = 'Enter a valid email address.';
		else if (
			value &&
			rule.options &&
			!rule.options.some((option) => option.value === value)
		)
			fieldErrors[key] = 'Choose from the listed options.';
	}
	return { values, fieldErrors };
}

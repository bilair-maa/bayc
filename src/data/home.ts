// Repeated content blocks on the home page, rendered by the home section components.

export interface Commitment {
	title: string;
	description: string;
}

export const commitments: readonly Commitment[] = [
	{
		title: 'Leadership',
		description:
			'Leadership development, mentorship, and professional engagement that expand opportunities for public service.',
	},
	{
		title: 'Heritage',
		description:
			'Preserving and celebrating Bengali language, literature, music, arts, history, and cultural traditions.',
	},
	{
		title: 'Civic Engagement',
		description:
			'Strengthening the civic voice and representation of Bangladeshi Americans through engagement with government, public institutions, and civic organizations.',
	},
];

export const programs: readonly string[] = [
	'Leadership Development',
	'Mentorship',
	'Civic Education',
	'Professional Engagement',
	'Community Service',
	'Public Dialogue',
];

export const principles: readonly string[] = [
	'Democracy',
	'Secularism',
	'Equality',
	'Social & Economic Justice',
	'Human Dignity',
	'Cultural Freedom',
	'Public Service',
];

export const audiences: readonly string[] = [
	'Students',
	'Young Professionals',
	'Emerging Leaders',
	'Community Members',
];

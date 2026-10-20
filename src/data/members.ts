// Public member directory. Only members who opted in belong here, and contact
// details are never listed: introductions go through BAYC.
// Bracketed values are placeholders until real, consented entries exist.

export const memberFields = [
	'Law',
	'Medicine & Health',
	'Engineering & Technology',
	'Business & Finance',
	'Public Service',
	'Education',
	'Arts & Media',
] as const;

export type MemberField = (typeof memberFields)[number];

export interface DirectoryMember {
	id: string;
	name: string;
	city: string;
	field: MemberField;
	profession: string;
}

export const members: readonly DirectoryMember[] = [
	{ id: 'm1', name: '[Member Name]', city: '[City, State]', field: 'Law', profession: '[Profession, e.g. Attorney]' },
	{ id: 'm2', name: '[Member Name]', city: '[City, State]', field: 'Medicine & Health', profession: '[Profession, e.g. Physician]' },
	{ id: 'm3', name: '[Member Name]', city: '[City, State]', field: 'Engineering & Technology', profession: '[Profession, e.g. Software Engineer]' },
	{ id: 'm4', name: '[Member Name]', city: '[City, State]', field: 'Business & Finance', profession: '[Profession, e.g. Accountant]' },
	{ id: 'm5', name: '[Member Name]', city: '[City, State]', field: 'Public Service', profession: '[Profession, e.g. City Planner]' },
	{ id: 'm6', name: '[Member Name]', city: '[City, State]', field: 'Education', profession: '[Profession, e.g. High School Teacher]' },
	{ id: 'm7', name: '[Member Name]', city: '[City, State]', field: 'Arts & Media', profession: '[Profession, e.g. Journalist]' },
	{ id: 'm8', name: '[Member Name]', city: '[City, State]', field: 'Medicine & Health', profession: '[Profession, e.g. Pharmacist]' },
	{ id: 'm9', name: '[Member Name]', city: '[City, State]', field: 'Engineering & Technology', profession: '[Profession, e.g. Civil Engineer]' },
	{ id: 'm10', name: '[Member Name]', city: '[City, State]', field: 'Law', profession: '[Profession, e.g. Paralegal]' },
	{ id: 'm11', name: '[Member Name]', city: '[City, State]', field: 'Business & Finance', profession: '[Profession, e.g. Small Business Owner]' },
	{ id: 'm12', name: '[Member Name]', city: '[City, State]', field: 'Public Service', profession: '[Profession, e.g. Legislative Aide]' },
];

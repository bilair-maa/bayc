// BAYC's founder, Leadership Council officers and Strategic Advisory Council.
// Bracketed values are placeholders until BAYC provides the real details.

export interface CouncilMember {
	id: string;
	name: string;
	title: string;
	city: string;
	shortBio: string;
	fullBio: string;
}

export const founder = {
	name: 'Anindya Dutta',
	role: 'Founder & Chair',
	city: 'Queens, NY',
	portrait: '/images/founder-anindya-dutta.jpg',
} as const;

export const officers: readonly CouncilMember[] = [
	{
		id: 'president',
		name: '[Full Name]',
		title: 'President',
		city: '[City, State]',
		shortBio: '[Brief bio, two or three sentences.]',
		fullBio: '[Longer bio: background, profession, and role at BAYC.]',
	},
	{
		id: 'vp-civic',
		name: '[Full Name]',
		title: 'Vice President, Civic Engagement & Public Affairs',
		city: '[City, State]',
		shortBio: '[Brief bio, two or three sentences.]',
		fullBio: '[Longer bio: background, profession, and role at BAYC.]',
	},
	{
		id: 'vp-community',
		name: '[Full Name]',
		title: 'Vice President, Community & Cultural Affairs',
		city: '[City, State]',
		shortBio: '[Brief bio, two or three sentences.]',
		fullBio: '[Longer bio: background, profession, and role at BAYC.]',
	},
	{
		id: 'vp-communications',
		name: '[Full Name]',
		title: 'Vice President, Communications & Organizational Secretary',
		city: '[City, State]',
		shortBio: '[Brief bio, two or three sentences.]',
		fullBio: '[Longer bio: background, profession, and role at BAYC.]',
	},
];

export const advisors: readonly CouncilMember[] = [
	{
		id: 'advisor-1',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
	{
		id: 'advisor-2',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
	{
		id: 'advisor-3',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
	{
		id: 'advisor-4',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
	{
		id: 'advisor-5',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
	{
		id: 'advisor-6',
		name: '[Full Name]',
		title: '[Title, Organization]',
		city: '[City, State]',
		shortBio: '[Brief bio, one or two sentences.]',
		fullBio: '[Longer bio: background and area of expertise.]',
	},
];

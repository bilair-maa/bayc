// Organization details and navigation shared by every page.

export interface NavLink {
	label: string;
	href: string;
}

export const site = {
	name: 'Bangladeshi American Youth Council',
	nameBengali: 'বাংলাদেশি আমেরিকান যুব পরিষদ',
	tagline: 'Leadership. Heritage. Civic Engagement.',
	descriptor: 'An independent, volunteer-led civic and community organization.',
	email: 'info@baycusa.org',
	location: 'New York, NY',
	domain: 'baycusa.org',
} as const;

export type SocialNetwork = 'instagram' | 'facebook' | 'linkedin';

export interface SocialProfile {
	network: SocialNetwork;
	label: string;
	// Set once the profile exists; until then the icon shows without a link.
	href?: string;
}

export const socialProfiles: readonly SocialProfile[] = [
	{ network: 'instagram', label: 'Instagram' },
	{ network: 'facebook', label: 'Facebook' },
	{ network: 'linkedin', label: 'LinkedIn' },
];

export const routes = {
	home: '/',
	about: '/about',
	founderLetter: '/about/founder',
	leadership: '/leadership',
	membership: '/membership',
	directory: '/directory',
	news: '/news',
	contact: '/contact',
} as const;

export function storyHref(storyId: string): string {
	return `${routes.news}/${storyId}`;
}

export function statementHref(statementId: string): string {
	return `${routes.news}/statements/${statementId}`;
}

export function storyCalendarHref(storyId: string): string {
	return `${storyHref(storyId)}/calendar.ics`;
}

// Anchor id of the application form on the Membership page.
export const membershipApplyId = 'apply';
export const applyHref = `${routes.membership}#${membershipApplyId}`;

// Anchor ids of the home page sections, shared by the sections and their links.
export const homeSections = {
	mission: 'mission',
	work: 'work',
	heritage: 'heritage',
	contact: 'contact',
} as const;

export type HomeSection = keyof typeof homeSections;

// Prefixed with the home route so the links still work from other pages.
export function homeSectionHref(section: HomeSection): string {
	return `${routes.home}#${homeSections[section]}`;
}

// Shared by the header and footer, which list the same pages.
export const siteNav: readonly NavLink[] = [
	{ label: 'About', href: routes.about },
	{ label: 'Leadership', href: routes.leadership },
	{ label: 'Membership', href: routes.membership },
	{ label: 'Directory', href: routes.directory },
	{ label: 'News & Events', href: routes.news },
	{ label: 'Contact', href: routes.contact },
];

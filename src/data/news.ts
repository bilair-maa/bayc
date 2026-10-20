// Official statements, news and events for the News & Statements page.
// Every entry is a placeholder: bracketed text, "#" links and stock photos
// stand in until BAYC publishes real items.

export interface Statement {
	id: string;
	date: string;
	title: string;
	href: string;
}

export type StoryType = 'News' | 'Event';

export interface StoryImage {
	src: string;
	width: number;
	height: number;
	// CSS object-position, to keep the subject in frame when cropped.
	focus: string;
}

export interface FeaturedStory {
	id: string;
	type: StoryType;
	date: string;
	title: string;
	href: string;
	callToAction: string;
	image: StoryImage;
}

export interface Story {
	id: string;
	type: StoryType;
	date: string;
	title: string;
	excerpt: string;
	href: string;
	image: StoryImage;
}

const photos = {
	riceFields: { src: '/images/hero-bangladesh-rice-fields.jpg', width: 2576, height: 1932 },
	riverBoats: { src: '/images/hero-bangladesh-river-boats.jpg', width: 4032, height: 2701 },
	newYork: { src: '/images/hero-new-york-skyline.jpg', width: 2576, height: 1640 },
} as const;

const placeholderDate = '[Month Day, Year]';

// The first three are pinned; the rest appear under "See All Statements".
export const statements: readonly Statement[] = Array.from({ length: 8 }, (_, index) => ({
	id: `statement-${index + 1}`,
	date: placeholderDate,
	title: '[Statement title]',
	href: '#',
}));

export const pinnedStatementCount = 3;

export const featuredStories: readonly FeaturedStory[] = [
	{
		id: 'featured-1',
		type: 'News',
		date: placeholderDate,
		title: '[Featured story headline]',
		href: '#',
		callToAction: 'Read the Story',
		image: { ...photos.riceFields, focus: '50% 55%' },
	},
	{
		id: 'featured-2',
		type: 'Event',
		date: placeholderDate,
		title: '[Upcoming event title]',
		href: '#',
		callToAction: 'Event Details',
		image: { ...photos.newYork, focus: '50% 50%' },
	},
	{
		id: 'featured-3',
		type: 'News',
		date: placeholderDate,
		title: '[Story headline]',
		href: '#',
		callToAction: 'Read the Story',
		image: { ...photos.riverBoats, focus: '55% 50%' },
	},
];

const newsExcerpt = '[Short summary of the story.]';
const eventExcerpt = '[Date, place, and a line about the event.]';

export const stories: readonly Story[] = [
	{ id: 'story-1', type: 'News', date: placeholderDate, title: '[News headline]', excerpt: newsExcerpt, href: '#', image: { ...photos.riceFields, focus: '70% 60%' } },
	{ id: 'story-2', type: 'Event', date: placeholderDate, title: '[Event title]', excerpt: eventExcerpt, href: '#', image: { ...photos.newYork, focus: '30% 50%' } },
	{ id: 'story-3', type: 'News', date: placeholderDate, title: '[News headline]', excerpt: newsExcerpt, href: '#', image: { ...photos.riverBoats, focus: '40% 50%' } },
	{ id: 'story-4', type: 'Event', date: placeholderDate, title: '[Event title]', excerpt: eventExcerpt, href: '#', image: { ...photos.newYork, focus: '50% 40%' } },
	{ id: 'story-5', type: 'News', date: placeholderDate, title: '[News headline]', excerpt: newsExcerpt, href: '#', image: { ...photos.riverBoats, focus: '30% 50%' } },
	{ id: 'story-6', type: 'News', date: placeholderDate, title: '[News headline]', excerpt: newsExcerpt, href: '#', image: { ...photos.riceFields, focus: '20% 40%' } },
];

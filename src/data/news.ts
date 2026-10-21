// Official statements, news and events for the News & Events pages, read
// from the Wix CMS "Statements", "News" and "Events" collections.
import {
	collections,
	getRecord,
	queryCollection,
	readBoolean,
	readCalendarDate,
	readDocumentUrl,
	readId,
	readImage,
	readInstant,
	readNumber,
	readGallery,
	readText,
	readWebUrl,
	type CmsImage,
	type CmsRecord,
} from './cms';
import { listItemsText, parseRichContent, wordCount, type ArticleBlock } from './richContent';
import { statementHref, storyHref } from './site';

// ---- Dates ------------------------------------------------------------

// BAYC is in New York; story and event times are shown in its time zone.
const siteTimeZone = 'America/New_York';

const calendarDateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: siteTimeZone });
const dayFormat = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	timeZone: siteTimeZone,
});
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: siteTimeZone });

// Statements carry a calendar date, `YYYY-MM-DD`.
export function formatCalendarDate(date: string): string {
	return calendarDateFormat.format(new Date(`${date}T00:00:00Z`));
}

// Stories and events carry an instant (ISO 8601).
export function formatDate(instant: string): string {
	return dateFormat.format(new Date(instant));
}

export function formatTime(instant: string): string {
	return timeFormat.format(new Date(instant));
}

export function formatEventDay(instant: string): string {
	return dayFormat.format(new Date(instant));
}

export function formatEventTimes(start: string, end?: string): string {
	return end ? timeFormat.formatRange(new Date(start), new Date(end)) : formatTime(start);
}

// ---- Statements -------------------------------------------------------

export interface Statement {
	id: string;
	// Calendar date, `YYYY-MM-DD`.
	date: string;
	title: string;
	href: string;
	pinned: boolean;
}

export interface StatementArticle extends Statement {
	keyPoints: readonly string[];
	body: readonly ArticleBlock[];
	signedBy?: string;
	pdfUrl?: string;
}

const maxStatements = 200;
// When nothing is pinned, the newest statements take the top spots.
const unpinnedTopCount = 3;
const otherStatementsCount = 3;

// Entries missing what the page needs to show or link them are left out.
// The New York calendar day of an instant, `YYYY-MM-DD`.
const calendarDayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: siteTimeZone });

// A statement shows the date typed in, or else the day it was published.
function toStatement(record: CmsRecord): Statement | undefined {
	const id = readId(record);
	const title = readText(record, 'title');
	const publishDate = readInstant(record, '_publishDate');
	const date = readCalendarDate(record, 'date') ?? (publishDate && calendarDayFormat.format(new Date(publishDate)));
	if (!id || !title || !date) return undefined;
	return { id, title, date, href: statementHref(id), pinned: readBoolean(record, 'pinned') };
}

async function getAllStatements(): Promise<readonly Statement[]> {
	const records = await queryCollection(collections.statements, {
		sorts: [{ field: '_publishDate', direction: 'descending' }],
		limit: maxStatements,
	});
	// Sorted here, since a statement's date may come from either field.
	return records
		.map(toStatement)
		.filter((statement) => statement !== undefined)
		.sort((a, b) => b.date.localeCompare(a.date));
}

export interface StatementGroups {
	top: readonly Statement[];
	older: readonly Statement[];
}

export async function getStatements(): Promise<StatementGroups> {
	const statements = await getAllStatements();
	const pinned = statements.filter((statement) => statement.pinned);
	const top = pinned.length > 0 ? pinned : statements.slice(0, unpinnedTopCount);
	return { top, older: statements.filter((statement) => !top.includes(statement)) };
}

function toStatementArticle(record: CmsRecord): StatementArticle | undefined {
	const statement = toStatement(record);
	if (!statement) return undefined;
	return {
		...statement,
		keyPoints: listItemsText(parseRichContent(record.keyPoints)),
		body: parseRichContent(record.body),
		signedBy: readText(record, 'signedBy'),
		pdfUrl: readDocumentUrl(record, 'pdf'),
	};
}

export async function getStatementArticle(id: string): Promise<StatementArticle | undefined> {
	const record = await getRecord(collections.statements, id);
	return record ? toStatementArticle(record) : undefined;
}

export async function getOtherStatements(excludeId: string): Promise<readonly Statement[]> {
	const statements = await getAllStatements();
	return statements.filter((statement) => statement.id !== excludeId).slice(0, otherStatementsCount);
}

// ---- Stories: News and Events -----------------------------------------

export type StoryType = 'News' | 'Event';

// A news item or event as it appears in lists, cards and the carousel.
export interface Story {
	id: string;
	type: StoryType;
	// ISO 8601 instant: when a news item was published, or when an event starts.
	date: string;
	title: string;
	summary?: string;
	// The story's own page on this site.
	href: string;
	image?: CmsImage;
}

// A paid event may not list its price.
export type Admission = { kind: 'free' } | { kind: 'paid'; priceUsd?: number };

export interface Speaker {
	name: string;
	role?: string;
	photo?: CmsImage;
}

interface ArticleBase extends Story {
	photoCaption?: string;
	body: readonly ArticleBlock[];
}

export interface NewsArticle extends ArticleBase {
	type: 'News';
	author?: string;
	readMinutes: number;
}

export interface EventArticle extends ArticleBase {
	type: 'Event';
	// ISO 8601 instants.
	start: string;
	end?: string;
	venueName?: string;
	venueAddress?: string;
	admission: Admission;
	rsvpRequired: boolean;
	agenda: readonly ArticleBlock[];
	speakers: readonly Speaker[];
	gettingThere?: string;
	rsvpLink?: string;
}

export type StoryArticle = NewsArticle | EventArticle;

const maxStoriesPerCollection = 200;
const relatedStoriesCount = 3;
const publishedAt = '_publishDate';
const wordsPerMinute = 225;

// Twice the rendered size, for high-density screens.
const slideBox = { width: 2400, height: 1160 };
const cardBox = { width: 800, height: 600 };
const articleBox = { width: 2560, height: 1100 };
const eventBox = { width: 1600, height: 900 };

type ImageBox = { width: number; height: number };

// Fields shared by both collections; `dateKey` is the field that dates it.
// News is dated by when it was published, which Wix records automatically.
function toStory(
	record: CmsRecord,
	type: StoryType,
	dateKey: typeof publishedAt | 'start',
	imageBox: ImageBox = cardBox,
): Story | undefined {
	const id = readId(record);
	const title = readText(record, 'title');
	const date = readInstant(record, dateKey);
	if (!id || !title || !date) return undefined;
	return {
		id,
		type,
		date,
		title,
		summary: readText(record, 'summary'),
		href: storyHref(id),
		image: readImage(record, 'photo', imageBox),
	};
}

function queryNews() {
	return queryCollection(collections.news, {
		sorts: [{ field: publishedAt, direction: 'descending' }],
		limit: maxStoriesPerCollection,
	});
}

function queryEvents(direction: 'ascending' | 'descending') {
	return queryCollection(collections.events, {
		sorts: [{ field: 'start', direction }],
		limit: maxStoriesPerCollection,
	});
}

// Newest first.
export async function getNews(): Promise<readonly Story[]> {
	const records = await queryNews();
	return records.map((record) => toStory(record, 'News', publishedAt)).filter((story) => story !== undefined);
}

export interface EventGroups {
	// Soonest first, sized for the slideshow.
	upcoming: readonly Story[];
	// Most recent first.
	past: readonly Story[];
}

export async function getEvents(now: Date): Promise<EventGroups> {
	const records = await queryEvents('ascending');
	const upcoming: Story[] = [];
	const past: Story[] = [];
	for (const record of records) {
		const start = readInstant(record, 'start');
		if (!start) continue;
		const isAhead = isUpcoming({ start, end: readInstant(record, 'end') }, now);
		const story = toStory(record, 'Event', 'start', isAhead ? slideBox : cardBox);
		if (!story) continue;
		if (isAhead) upcoming.push(story);
		else past.unshift(story);
	}
	return { upcoming, past };
}

export async function getRelatedStories(excludeId: string): Promise<readonly Story[]> {
	const [newsRecords, eventRecords] = await Promise.all([queryNews(), queryEvents('descending')]);
	const stories = [
		...newsRecords.map((record) => toStory(record, 'News', publishedAt)),
		...eventRecords.map((record) => toStory(record, 'Event', 'start')),
	].filter((story) => story !== undefined);
	return stories
		.filter((story) => story.id !== excludeId)
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, relatedStoriesCount);
}

// Twice the rendered 64×80 speaker photo, for high-density screens.
const speakerPhotoBox = { width: 128, height: 160 };

// Speakers are photos on the event: the photo's title is the name, its
// description the role. A photo without a title isn't shown.
function toSpeakers(record: CmsRecord): readonly Speaker[] {
	return readGallery(record, 'speakers', speakerPhotoBox).flatMap(({ image, title, description }) =>
		title ? [{ name: title, role: description, photo: image }] : [],
	);
}

function toNewsArticle(record: CmsRecord): NewsArticle | undefined {
	const story = toStory(record, 'News', publishedAt, articleBox);
	if (!story) return undefined;
	const body = parseRichContent(record.body);
	return {
		...story,
		type: 'News',
		photoCaption: readText(record, 'photoCaption'),
		body,
		author: readText(record, 'author'),
		readMinutes: Math.max(1, Math.round(wordCount(body) / wordsPerMinute)),
	};
}

function toEventArticle(record: CmsRecord): EventArticle | undefined {
	const story = toStory(record, 'Event', 'start', eventBox);
	if (!story) return undefined;
	return {
		...story,
		type: 'Event',
		photoCaption: readText(record, 'photoCaption'),
		body: parseRichContent(record.body),
		start: story.date,
		end: readInstant(record, 'end'),
		venueName: readText(record, 'venueName'),
		venueAddress: readText(record, 'venueAddress'),
		admission: readBoolean(record, 'paid') ? { kind: 'paid', priceUsd: readNumber(record, 'price') } : { kind: 'free' },
		rsvpRequired: readBoolean(record, 'rsvpRequired'),
		agenda: parseRichContent(record.agenda),
		speakers: toSpeakers(record),
		gettingThere: readText(record, 'gettingThere'),
		rsvpLink: readWebUrl(record, 'link'),
	};
}

// Story pages share one address scheme, so the id is looked up in both collections.
export async function getStoryArticle(id: string): Promise<StoryArticle | undefined> {
	const [newsRecord, eventRecord] = await Promise.all([
		getRecord(collections.news, id),
		getRecord(collections.events, id),
	]);
	if (newsRecord) return toNewsArticle(newsRecord);
	if (eventRecord) return toEventArticle(eventRecord);
	return undefined;
}

export async function getEventArticle(id: string): Promise<EventArticle | undefined> {
	const record = await getRecord(collections.events, id);
	return record ? toEventArticle(record) : undefined;
}

// ---- Any entry as its page shows it (used by the Admin draft previews) ----

export type ArticleCollection = 'news' | 'events' | 'statements';

export type ArticleEntry =
	| { kind: 'story'; story: StoryArticle }
	| { kind: 'statement'; statement: StatementArticle };

export function toArticleEntry(collection: ArticleCollection, record: CmsRecord): ArticleEntry | undefined {
	switch (collection) {
		case 'news': {
			const story = toNewsArticle(record);
			return story ? { kind: 'story', story } : undefined;
		}
		case 'events': {
			const story = toEventArticle(record);
			return story ? { kind: 'story', story } : undefined;
		}
		case 'statements': {
			const statement = toStatementArticle(record);
			return statement ? { kind: 'statement', statement } : undefined;
		}
	}
}

// An event is upcoming until it ends (or, without an end time, until it starts).
export function isUpcoming(event: Pick<EventArticle, 'start' | 'end'>, now: Date): boolean {
	return new Date(event.end ?? event.start).getTime() > now.getTime();
}

// e.g. "Free · RSVP required" or "$15".
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function admissionLabel(event: Pick<EventArticle, 'admission' | 'rsvpRequired'>): string {
	const { admission } = event;
	const cost = admission.kind === 'free' ? 'Free' : admission.priceUsd !== undefined ? usdFormat.format(admission.priceUsd) : 'Paid';
	return event.rsvpRequired ? `${cost} · RSVP required` : cost;
}

export function mapsHref(address: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

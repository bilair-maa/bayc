// The one place the site talks to the Wix CMS. Pages get plain, validated
// values from the data modules and never see Wix SDK types.
//
// Collections are public to read and admin-only to write, and drafts are
// excluded by Wix itself, so a visitor-scoped read returns only published items.
import { items } from '@wix/data';
import { media } from '@wix/sdk';

export type CmsRecord = Readonly<Record<string, unknown>>;

export const collections = {
	members: 'members',
	founder: 'founder',
	leadership: 'leadership',
	statements: 'statements',
	news: 'news',
	events: 'events',
} as const;

type CollectionId = (typeof collections)[keyof typeof collections];

interface Sort {
	field: string;
	direction: 'ascending' | 'descending';
}

interface QueryOptions {
	sorts: readonly Sort[];
	limit: number;
	// Reference fields (dropdowns, pick lists) whose entries are loaded in full.
	references?: readonly string[];
}

// Wix caps a single query at 1000 items.
const maxQueryLimit = 1000;

export async function queryCollection(
	collectionId: CollectionId,
	{ sorts, limit, references = [] }: QueryOptions,
): Promise<readonly CmsRecord[]> {
	let query = items.query(collectionId).limit(Math.min(limit, maxQueryLimit));
	for (const sort of sorts) {
		query = sort.direction === 'ascending' ? query.ascending(sort.field) : query.descending(sort.field);
	}
	if (references.length > 0) query = query.include(...references);
	const result = await query.find();
	return result.items;
}

// Wix item ids are GUIDs; anything else (e.g. a mistyped URL) can't match one.
const itemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRecord(collectionId: CollectionId, id: string): Promise<CmsRecord | undefined> {
	if (!itemIdPattern.test(id)) return undefined;
	const result = await items.query(collectionId).eq('_id', id).limit(1).find();
	return result.items[0];
}

// A plain object from a CMS value (e.g. one item of a gallery field).
export function parseCmsRecord(value: unknown): CmsRecord | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}

export interface CmsGalleryItem {
	image: CmsImage;
	title?: string;
	description?: string;
}

// A Media Gallery field: photos, each with an optional title and description.
// Videos in a gallery are skipped.
export function readGallery(record: CmsRecord, key: string, box: { width: number; height: number }): readonly CmsGalleryItem[] {
	const value = record[key];
	if (!Array.isArray(value)) return [];
	return value.flatMap((item: unknown) => {
		const entry = parseCmsRecord(item);
		if (!entry || (entry.type !== undefined && entry.type !== 'image')) return [];
		const image = readImage(entry, 'src', box);
		return image ? [{ image, title: readText(entry, 'title'), description: readText(entry, 'description') }] : [];
	});
}

// The chosen option of a dropdown field, as the label editors picked.
export function readDropdown(record: CmsRecord, key: string): string | undefined {
	const option = record[key];
	if (typeof option !== 'object' || option === null) return undefined;
	const title: unknown = Reflect.get(option, 'title');
	return typeof title === 'string' && title.trim() !== '' ? title.trim() : undefined;
}

export function readText(record: CmsRecord, key: string): string | undefined {
	const value = record[key];
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

export function readNumber(record: CmsRecord, key: string): number | undefined {
	const value = record[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(record: CmsRecord, key: string): boolean {
	return record[key] === true;
}

export function readId(record: CmsRecord): string | undefined {
	return readText(record, '_id');
}

// DATE fields arrive as `YYYY-MM-DD`; kept as a calendar date, not an instant.
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function readCalendarDate(record: CmsRecord, key: string): string | undefined {
	const value = readText(record, key);
	return value && calendarDatePattern.test(value) ? value : undefined;
}

// DATETIME fields are instants; returned as ISO 8601 UTC strings.
export function readInstant(record: CmsRecord, key: string): string | undefined {
	const value = record[key];
	const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
	return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
}

// Only web links: blocks `javascript:` and other schemes an editor might paste.
export function readWebUrl(record: CmsRecord, key: string): string | undefined {
	const value = readText(record, key);
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
	} catch {
		return undefined;
	}
}

export interface CmsImage {
	src: string;
	width: number;
	height: number;
}

// Images uploaded in the CMS are `wix:image://` ids, which Wix scales and crops
// to the requested box. A pasted https URL is used as is.
export function readImage(
	record: CmsRecord,
	key: string,
	box: { width: number; height: number },
): CmsImage | undefined {
	const value = readText(record, key);
	if (!value) return undefined;
	if (value.startsWith('wix:image://')) {
		return { src: media.getScaledToFillImageUrl(value, box.width, box.height, {}), ...box };
	}
	const url = readWebUrl(record, key);
	return url?.startsWith('https:') ? { src: url, ...box } : undefined;
}

export function readDocumentUrl(record: CmsRecord, key: string): string | undefined {
	const value = readText(record, key);
	if (!value) return undefined;
	if (value.startsWith('wix:document://')) return media.getDocumentUrl(value).url;
	return readWebUrl(record, key);
}

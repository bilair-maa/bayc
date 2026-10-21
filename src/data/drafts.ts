// Unpublished News, Events and Statements, read with the admin API key.
// Server-only; callers must confirm the visitor is an Admin first.
import { adminApiPost } from './adminApi';
import { parseCmsRecord, type CmsRecord } from './cms';
import { toArticleEntry, type ArticleCollection, type ArticleEntry } from './news';

export const draftCollections: readonly { id: ArticleCollection; label: string }[] = [
	{ id: 'news', label: 'News' },
	{ id: 'events', label: 'Events' },
	{ id: 'statements', label: 'Statements' },
];

export function isDraftCollection(value: string | undefined): value is ArticleCollection {
	return draftCollections.some((collection) => collection.id === value);
}

export function draftHref(collection: ArticleCollection, id: string): string {
	return `/drafts/${collection}/${id}`;
}

export interface DraftSummary {
	collection: ArticleCollection;
	id: string;
	title: string;
	// ISO 8601 instant.
	updatedAt?: string;
	href: string;
}

const maxDraftsPerCollection = 100;
const itemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The REST API wraps dates as `{ $date: "…" }`; the site's readers take ISO strings.
function unwrapDates(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(unwrapDates);
	if (typeof value !== 'object' || value === null) return value;
	const date: unknown = Reflect.get(value, '$date');
	if (typeof date === 'string' && Object.keys(value).length === 1) return date;
	return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, unwrapDates(inner)]));
}

function recordsOf(response: unknown): readonly CmsRecord[] {
	const list: unknown = typeof response === 'object' && response !== null ? Reflect.get(response, 'dataItems') : undefined;
	if (!Array.isArray(list)) return [];
	return list.flatMap((item: unknown) => {
		const data = typeof item === 'object' && item !== null ? parseCmsRecord(unwrapDates(Reflect.get(item, 'data'))) : undefined;
		return data ? [data] : [];
	});
}

function queryDrafts(collection: ArticleCollection, filter: Record<string, unknown>, limit: number) {
	return adminApiPost('/wix-data/v2/items/query', {
		dataCollectionId: collection,
		publishPluginOptions: { includeDraftItems: true },
		query: { filter: { _publishStatus: 'DRAFT', ...filter }, sort: [{ fieldName: '_updatedDate', order: 'DESC' }], paging: { limit } },
	});
}

export async function listDrafts(): Promise<readonly DraftSummary[]> {
	const lists = await Promise.all(
		draftCollections.map(async ({ id: collection }) =>
			recordsOf(await queryDrafts(collection, {}, maxDraftsPerCollection)).flatMap((record) => {
				const id = typeof record._id === 'string' ? record._id : undefined;
				const title = typeof record.title === 'string' && record.title.trim() !== '' ? record.title.trim() : 'Untitled draft';
				if (!id) return [];
				const updatedAt = typeof record._updatedDate === 'string' ? record._updatedDate : undefined;
				return [{ collection, id, title, updatedAt, href: draftHref(collection, id) }];
			}),
		),
	);
	return lists.flat();
}

// A draft laid out as its page will show it. Not yet published, it's dated as
// if published now, which is what visitors will see on publishing it.
export async function getDraftEntry(collection: ArticleCollection, id: string, now: Date): Promise<ArticleEntry | undefined> {
	if (!itemIdPattern.test(id)) return undefined;
	const [record] = recordsOf(await queryDrafts(collection, { _id: id }, 1));
	if (!record) return undefined;
	return toArticleEntry(collection, { ...record, _publishDate: record._publishDate ?? now.toISOString() });
}

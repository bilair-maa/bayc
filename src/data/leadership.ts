// BAYC's founder, Leadership Council officers and Strategic Advisory Council.
// The Leadership page reads them from the Wix CMS "Founder" (a single entry)
// and "Leadership" collections.
import {
	collections,
	queryCollection,
	readDropdown,
	readId,
	readImage,
	readNumber,
	readText,
	type CmsImage,
	type CmsRecord,
} from './cms';
import { parseRichContent, type ArticleBlock } from './richContent';

// Signs the founder's letter on the home, About and founder letter pages,
// which are written in his voice and so stay in code.
export const founder = {
	name: 'Anindya Dutta',
	role: 'Founder & Chair',
	portrait: '/images/founder-anindya-dutta.jpg',
} as const;

export interface FounderProfile {
	name: string;
	title?: string;
	city?: string;
	bio: readonly ArticleBlock[];
	photo?: CmsImage;
}

export type LeadershipGroup = 'council' | 'advisory';

export interface Leader {
	id: string;
	group: LeadershipGroup;
	name: string;
	title?: string;
	city?: string;
	shortBio?: string;
	fullBio: readonly ArticleBlock[];
	photo?: CmsImage;
}

export interface Leadership {
	founder?: FounderProfile;
	officers: readonly Leader[];
	advisors: readonly Leader[];
}

// Labels of the "Leadership Groups" dropdown options, matched loosely so a
// small edit to an option's wording still places entries correctly.
const groupsByLabel: Readonly<Record<string, LeadershipGroup>> = {
	'leadership council': 'council',
	'advisory council': 'advisory',
	'strategic advisory council': 'advisory',
};

function readGroup(record: CmsRecord): LeadershipGroup | undefined {
	const label = readDropdown(record, 'group')?.toLowerCase().replace(/\s+/g, ' ');
	return label ? groupsByLabel[label] : undefined;
}

// Twice each largest rendered 4:5 box, for high-density screens.
const founderPhotoBox = { width: 680, height: 850 };
const photoBoxes: Readonly<Record<LeadershipGroup, { width: number; height: number }>> = {
	council: { width: 640, height: 800 },
	advisory: { width: 224, height: 280 },
};

const maxLeaders = 200;

function toFounder(record: CmsRecord): FounderProfile | undefined {
	const name = readText(record, 'name');
	if (!name) return undefined;
	return {
		name,
		title: readText(record, 'title'),
		city: readText(record, 'city'),
		bio: parseRichContent(record.bio),
		photo: readImage(record, 'photo', founderPhotoBox),
	};
}

// An entry without a recognized group has no place on the page, so it is left out.
function toLeader(record: CmsRecord): Leader | undefined {
	const id = readId(record);
	const name = readText(record, 'name');
	const group = readGroup(record);
	if (!id || !name || !group) return undefined;
	return {
		id,
		group,
		name,
		title: readText(record, 'title'),
		city: readText(record, 'city'),
		shortBio: readText(record, 'shortBio'),
		fullBio: parseRichContent(record.fullBio),
		photo: readImage(record, 'photo', photoBoxes[group]),
	};
}

// Entries without an order number go last, then by name.
function byOrderThenName(a: { order?: number; leader: Leader }, b: { order?: number; leader: Leader }) {
	const orderA = a.order ?? Number.POSITIVE_INFINITY;
	const orderB = b.order ?? Number.POSITIVE_INFINITY;
	if (orderA !== orderB) return orderA - orderB;
	return a.leader.name.localeCompare(b.leader.name, 'en');
}

export async function getLeadership(): Promise<Leadership> {
	const [founderRecords, leaderRecords] = await Promise.all([
		queryCollection(collections.founder, { sorts: [], limit: 1 }),
		queryCollection(collections.leadership, { sorts: [], limit: maxLeaders, references: ['group'] }),
	]);
	const leaders = leaderRecords
		.map((record) => ({ order: readNumber(record, 'order'), leader: toLeader(record) }))
		.filter((entry): entry is { order: number | undefined; leader: Leader } => entry.leader !== undefined)
		.sort(byOrderThenName)
		.map((entry) => entry.leader);

	const founderRecord = founderRecords[0];
	return {
		founder: founderRecord ? toFounder(founderRecord) : undefined,
		officers: leaders.filter((leader) => leader.group === 'council'),
		advisors: leaders.filter((leader) => leader.group === 'advisory'),
	};
}

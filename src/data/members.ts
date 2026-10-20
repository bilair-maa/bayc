// Public member directory, managed in the Wix CMS "Members" collection.
// Only members who agreed to be listed are entered there, and contact details
// are never stored: introductions go through BAYC.
import { collections, queryCollection, readId, readImage, readText, type CmsImage, type CmsRecord } from './cms';

export interface DirectoryMember {
	id: string;
	name: string;
	profession?: string;
	field?: string;
	city?: string;
	photo?: CmsImage;
}

// Twice the rendered 88×110 box, for high-density screens.
const photoBox = { width: 176, height: 220 };
const maxMembers = 1000;

function toMember(record: CmsRecord): DirectoryMember | undefined {
	const id = readId(record);
	const name = readText(record, 'name');
	if (!id || !name) return undefined;
	return {
		id,
		name,
		profession: readText(record, 'profession'),
		field: readText(record, 'field'),
		city: readText(record, 'city'),
		photo: readImage(record, 'photo', photoBox),
	};
}

export async function getDirectoryMembers(): Promise<readonly DirectoryMember[]> {
	const records = await queryCollection(collections.members, {
		sorts: [{ field: 'name', direction: 'ascending' }],
		limit: maxMembers,
	});
	return records.map(toMember).filter((member) => member !== undefined);
}

// Filter options come from the fields members actually list, so no filter is ever empty.
export function fieldsOf(members: readonly DirectoryMember[]): readonly string[] {
	const fields = new Set(members.map((member) => member.field).filter((field) => field !== undefined));
	return [...fields].sort((a, b) => a.localeCompare(b, 'en'));
}

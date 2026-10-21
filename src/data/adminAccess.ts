// Decides whether the visitor may see draft previews: they must be signed in
// as a site member who holds the "Admin" badge (assigned in the dashboard
// under Customers & Leads > Members). Server-only.
import { members } from '@wix/members';
import { adminApiConfigured, adminApiPost } from './adminApi';

export type AdminAccess =
	| { kind: 'unavailable' }
	| { kind: 'signed-out' }
	| { kind: 'not-admin' }
	| { kind: 'admin' };

// The badge's slug, generated from its title "Admin".
const adminBadgeSlug = 'admin';

async function currentMemberId(): Promise<string | undefined> {
	try {
		const { member } = await members.getCurrentMember();
		return member?._id ?? undefined;
	} catch {
		// Not signed in: a normal state, not an error.
		return undefined;
	}
}

function firstId(response: unknown, listKey: string): string | undefined {
	if (typeof response !== 'object' || response === null) return undefined;
	const list: unknown = Reflect.get(response, listKey);
	if (!Array.isArray(list) || list.length === 0) return undefined;
	const id: unknown = Reflect.get(list[0], 'id');
	return typeof id === 'string' ? id : undefined;
}

async function holdsAdminBadge(memberId: string): Promise<boolean> {
	const badges = await adminApiPost('/badges/v4/badges/query', { query: { filter: { slug: adminBadgeSlug } } });
	const badgeId = firstId(badges, 'badges');
	if (!badgeId) return false;
	const assignments = await adminApiPost('/badges/v4/assignments/query', {
		query: { filter: { badgeId, memberId }, cursorPaging: { limit: 1 } },
	});
	return firstId(assignments, 'badgeAssignments') !== undefined;
}

export async function getAdminAccess(): Promise<AdminAccess> {
	if (!adminApiConfigured()) return { kind: 'unavailable' };
	const memberId = await currentMemberId();
	if (!memberId) return { kind: 'signed-out' };
	return (await holdsAdminBadge(memberId)) ? { kind: 'admin' } : { kind: 'not-admin' };
}

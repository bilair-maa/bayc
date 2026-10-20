import type { APIRoute } from 'astro';
import { getEventArticle } from '../../../data/news';
import { site, storyHref } from '../../../data/site';

// "Add to calendar" for an event: a one-event iCalendar file (RFC 5545).

const icsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Commas, semicolons, backslashes and line breaks must be escaped in text values.
const icsText = (value: string) => value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets are folded onto continuation lines.
function fold(line: string): string {
	const encoder = new TextEncoder();
	const parts: string[] = [];
	let current = '';
	for (const char of line) {
		if (encoder.encode(current + char).length > 75) {
			parts.push(current);
			current = ` ${char}`;
		} else {
			current += char;
		}
	}
	parts.push(current);
	return parts.join('\r\n');
}

export const GET: APIRoute = async ({ params, url }) => {
	const story = await getEventArticle(params.id ?? '');
	if (!story) return new Response('Not found', { status: 404 });

	const pageUrl = new URL(storyHref(story.id), url).href;
	const location = [story.venueName, story.venueAddress].filter((part) => part !== undefined).join(', ');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:-//${icsText(site.name)}//Events//EN`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${story.id}@${site.domain}`,
		`DTSTAMP:${icsDate(new Date().toISOString())}`,
		`DTSTART:${icsDate(story.start)}`,
		...(story.end ? [`DTEND:${icsDate(story.end)}`] : []),
		`SUMMARY:${icsText(story.title)}`,
		...(story.summary ? [`DESCRIPTION:${icsText(`${story.summary}\n\n${pageUrl}`)}`] : [`DESCRIPTION:${icsText(pageUrl)}`]),
		...(location ? [`LOCATION:${icsText(location)}`] : []),
		`URL:${pageUrl}`,
		'END:VEVENT',
		'END:VCALENDAR',
	];

	return new Response(`${lines.map(fold).join('\r\n')}\r\n`, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'attachment; filename="bayc-event.ics"',
		},
	});
};

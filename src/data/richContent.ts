// Parses a CMS "Rich Content" field (the block editor's Ricos document) into
// the blocks the site renders. Text is rendered through Astro, which escapes
// it, so nothing from the CMS is inserted into the page as raw HTML.
//
// Colors, fonts and sizes picked in the editor are deliberately ignored so
// every page follows the site's design. HTML and third-party embed blocks are
// not shown.
import { media } from '@wix/sdk';

export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	link?: string;
}

export interface ArticleImage {
	src: string;
	width: number;
	height: number;
	alt: string;
	link?: string;
}

export interface TableCell {
	// Which way a header cell labels: down its column or across its row.
	header?: 'col' | 'row';
	colspan: number;
	rowspan: number;
	blocks: readonly ArticleBlock[];
}

export interface CollapsibleItem {
	title: readonly TextRun[];
	body: readonly ArticleBlock[];
}

export type ArticleBlock =
	| { kind: 'paragraph'; runs: readonly TextRun[] }
	| { kind: 'heading'; level: 2 | 3 | 4; runs: readonly TextRun[] }
	| { kind: 'list'; ordered: boolean; items: readonly (readonly ArticleBlock[])[] }
	| { kind: 'quote'; blocks: readonly ArticleBlock[]; attribution?: readonly TextRun[] }
	| { kind: 'code'; text: string }
	| { kind: 'image'; image: ArticleImage }
	| { kind: 'caption'; runs: readonly TextRun[] }
	| { kind: 'gallery'; images: readonly ArticleImage[] }
	| { kind: 'video'; src: string; title: string; player: 'embed' | 'file' }
	| { kind: 'button'; label: string; href: string }
	| { kind: 'table'; rows: readonly (readonly TableCell[])[] }
	| { kind: 'collapsible'; items: readonly CollapsibleItem[]; openFirst: boolean; openAll: boolean }
	| { kind: 'divider' };

type Json = Readonly<Record<string, unknown>>;

function asObject(value: unknown): Json | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function at(value: unknown, ...path: readonly string[]): unknown {
	return path.reduce<unknown>((current, key) => asObject(current)?.[key], value);
}

function childNodes(node: Json): readonly Json[] {
	const nodes = node.nodes;
	if (!Array.isArray(nodes)) return [];
	return nodes.map(asObject).filter((child) => child !== undefined);
}

function parseUrl(value: unknown): URL | undefined {
	const text = asString(value);
	if (!text) return undefined;
	try {
		return new URL(text);
	} catch {
		return undefined;
	}
}

// Editors can only link to web pages and email addresses.
function safeLink(value: unknown): string | undefined {
	const url = parseUrl(value);
	return url && ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
}

function httpsUrl(value: unknown): string | undefined {
	const url = parseUrl(value);
	return url?.protocol === 'https:' ? url.href : undefined;
}

function toRun(node: Json): TextRun | undefined {
	const text = at(node, 'textData', 'text');
	if (typeof text !== 'string' || text === '') return undefined;
	const rawDecorations = at(node, 'textData', 'decorations');
	const decorations = Array.isArray(rawDecorations)
		? rawDecorations.map(asObject).filter((decoration) => decoration !== undefined)
		: [];
	const has = (type: string) => decorations.some((decoration) => decoration.type === type);
	const linkDecoration = decorations.find((decoration) => decoration.type === 'LINK');
	return {
		text,
		bold: has('BOLD'),
		italic: has('ITALIC'),
		underline: has('UNDERLINE'),
		link: safeLink(at(linkDecoration, 'linkData', 'link', 'url')),
	};
}

// Text runs anywhere under a node, e.g. the TEXT nodes inside a paragraph.
function runsOf(node: Json): readonly TextRun[] {
	return childNodes(node).flatMap((child) => {
		const run = toRun(child);
		return run ? [run] : runsOf(child);
	});
}

function plainTextOf(node: Json): string {
	return runsOf(node)
		.map((run) => run.text)
		.join('');
}

// The page title is the only h1, so headings in the content start at h2.
function headingLevel(node: Json): 2 | 3 | 4 {
	const level = at(node, 'headingData', 'level');
	if (typeof level !== 'number' || level <= 2) return 2;
	return level === 3 ? 3 : 4;
}

// Twice the article column's width, for high-density screens.
const maxImageWidth = 1440;

// Images uploaded in the editor arrive as Wix media ids; pasted ones as URLs.
function toImage(mediaValue: unknown, alt: unknown, link: unknown): ArticleImage | undefined {
	const width = asNumber(at(mediaValue, 'width'));
	const height = asNumber(at(mediaValue, 'height'));
	if (!width || !height) return undefined;
	const scale = Math.min(1, maxImageWidth / width);
	const box = { width: Math.round(width * scale), height: Math.round(height * scale) };
	const id = asString(at(mediaValue, 'src', 'id'));
	// The box keeps the photo's proportions, so "fill" never crops it.
	const src = id
		? media.getScaledToFillImageUrl(`wix:image://v1/${id}/${id}#originWidth=${width}&originHeight=${height}`, box.width, box.height, {})
		: httpsUrl(at(mediaValue, 'src', 'url'));
	if (!src) return undefined;
	return { src, ...box, alt: asString(alt) ?? '', link: safeLink(link) };
}

const youTubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const vimeoHosts = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const videoFilePattern = /\.(mp4|webm|ogg)$/i;
const videoIdPattern = /^[\w-]{6,20}$/;

function toVideo(node: Json): ArticleBlock | undefined {
	const url = parseUrl(at(node, 'videoData', 'video', 'src', 'url'));
	if (!url || url.protocol !== 'https:') return undefined;
	const title = asString(at(node, 'videoData', 'title')) ?? 'Video';
	if (youTubeHosts.has(url.hostname)) {
		const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : (url.searchParams.get('v') ?? url.pathname.split('/').pop());
		return id && videoIdPattern.test(id)
			? { kind: 'video', src: `https://www.youtube-nocookie.com/embed/${id}`, title, player: 'embed' }
			: undefined;
	}
	if (vimeoHosts.has(url.hostname)) {
		const id = url.pathname.split('/').filter(Boolean).pop();
		return id && /^\d+$/.test(id) ? { kind: 'video', src: `https://player.vimeo.com/video/${id}`, title, player: 'embed' } : undefined;
	}
	return videoFilePattern.test(url.pathname) ? { kind: 'video', src: url.href, title, player: 'file' } : undefined;
}

function toButton(node: Json): ArticleBlock | undefined {
	const label = asString(at(node, 'buttonData', 'text'));
	const href = safeLink(at(node, 'buttonData', 'link', 'url'));
	return label && href ? { kind: 'button', label: label.trim(), href } : undefined;
}

function toGallery(node: Json): ArticleBlock | undefined {
	const items = at(node, 'galleryData', 'items');
	if (!Array.isArray(items)) return undefined;
	const images = items.flatMap((item) => {
		const image = toImage(at(item, 'image', 'media'), at(item, 'altText') ?? at(item, 'title'), at(item, 'image', 'link', 'url'));
		return image ? [image] : [];
	});
	return images.length > 0 ? { kind: 'gallery', images } : undefined;
}

function spanOf(value: unknown): number {
	return typeof value === 'number' && Number.isInteger(value) && value > 1 ? value : 1;
}

function toTable(node: Json): ArticleBlock | undefined {
	const firstRowIsHeader = at(node, 'tableData', 'rowHeader') === true || at(node, 'tableData', 'header') === true;
	const firstColumnIsHeader = at(node, 'tableData', 'columnHeader') === true;
	const rows = childNodes(node)
		.filter((row) => row.type === 'TABLE_ROW')
		.map((row, rowIndex) =>
			childNodes(row)
				.filter((cell) => cell.type === 'TABLE_CELL')
				.map((cell, columnIndex) => ({
					header:
						firstRowIsHeader && rowIndex === 0
							? ('col' as const)
							: firstColumnIsHeader && columnIndex === 0
								? ('row' as const)
								: undefined,
					colspan: spanOf(at(cell, 'tableCellData', 'colspan')),
					rowspan: spanOf(at(cell, 'tableCellData', 'rowspan')),
					blocks: toBlocks(childNodes(cell)),
				})),
		)
		.filter((row) => row.length > 0);
	return rows.length > 0 ? { kind: 'table', rows } : undefined;
}

function toCollapsible(node: Json): ArticleBlock | undefined {
	const items = childNodes(node)
		.filter((item) => item.type === 'COLLAPSIBLE_ITEM')
		.map((item) => {
			const part = (type: string) => childNodes(item).find((child) => child.type === type);
			const title = part('COLLAPSIBLE_ITEM_TITLE');
			const body = part('COLLAPSIBLE_ITEM_BODY');
			return { title: title ? runsOf(title) : [], body: body ? toBlocks(childNodes(body)) : [] };
		})
		.filter((item) => item.title.length > 0);
	if (items.length === 0) return undefined;
	const initiallyOpen = at(node, 'collapsibleListData', 'initialExpandedItems');
	return { kind: 'collapsible', items, openFirst: initiallyOpen === 'FIRST', openAll: initiallyOpen === 'ALL' };
}

function single(block: ArticleBlock | undefined): readonly ArticleBlock[] {
	return block ? [block] : [];
}

function withRuns(kind: 'paragraph' | 'caption', node: Json): readonly ArticleBlock[] {
	const runs = runsOf(node);
	return runs.some((run) => run.text.trim() !== '') ? [{ kind, runs }] : [];
}

// Block types that carry nothing the site shows (HTML, embeds, polls…).
const skippedTypes = new Set(['HTML', 'EMBED', 'APP_EMBED', 'POLL', 'LINK_PREVIEW', 'MAP', 'AUDIO', 'FILE', 'GIF']);

function toBlocks(nodes: readonly Json[]): readonly ArticleBlock[] {
	return nodes.flatMap((node): readonly ArticleBlock[] => {
		switch (node.type) {
			case 'PARAGRAPH':
				return withRuns('paragraph', node);
			case 'CAPTION':
				return withRuns('caption', node);
			case 'HEADING': {
				const runs = runsOf(node);
				return runs.length > 0 ? [{ kind: 'heading', level: headingLevel(node), runs }] : [];
			}
			case 'BULLETED_LIST':
			case 'ORDERED_LIST': {
				const items = childNodes(node)
					.map((item) => toBlocks(childNodes(item)))
					.filter((item) => item.length > 0);
				return items.length > 0 ? [{ kind: 'list', ordered: node.type === 'ORDERED_LIST', items }] : [];
			}
			case 'BLOCKQUOTE': {
				const blocks = toBlocks(childNodes(node));
				return blocks.length > 0 ? [{ kind: 'quote', blocks }] : [];
			}
			case 'CODE_BLOCK': {
				const text = plainTextOf(node);
				return text ? [{ kind: 'code', text }] : [];
			}
			case 'IMAGE': {
				const image = toImage(at(node, 'imageData', 'image'), at(node, 'imageData', 'altText'), at(node, 'imageData', 'link', 'url'));
				return [...(image ? [{ kind: 'image', image } as const] : []), ...toBlocks(childNodes(node))];
			}
			case 'GALLERY':
				return single(toGallery(node));
			case 'VIDEO':
				return [...single(toVideo(node)), ...toBlocks(childNodes(node))];
			case 'BUTTON':
				return single(toButton(node));
			case 'TABLE':
				return single(toTable(node));
			case 'COLLAPSIBLE_LIST':
				return single(toCollapsible(node));
			case 'DIVIDER':
				return [{ kind: 'divider' }];
			default:
				// Containers the site doesn't lay out (layouts, cards…) still show
				// the content inside them.
				return typeof node.type === 'string' && skippedTypes.has(node.type) ? [] : toBlocks(childNodes(node));
		}
	});
}

const attributionDash = /^\s*[—–-]\s*/;

// A paragraph starting with a dash right after a quote names who said it
// (the editor allows only one paragraph inside a quote).
function attachAttributions(blocks: readonly ArticleBlock[]): readonly ArticleBlock[] {
	const result: ArticleBlock[] = [];
	for (const block of blocks) {
		const previous = result[result.length - 1];
		const firstRun = block.kind === 'paragraph' ? block.runs[0] : undefined;
		if (block.kind === 'paragraph' && previous?.kind === 'quote' && !previous.attribution && firstRun && attributionDash.test(firstRun.text)) {
			const runs = [{ ...firstRun, text: firstRun.text.replace(attributionDash, '') }, ...block.runs.slice(1)];
			result[result.length - 1] = { ...previous, attribution: runs };
			continue;
		}
		result.push(block);
	}
	return result;
}

export function parseRichContent(value: unknown): readonly ArticleBlock[] {
	const document = asObject(value);
	return document ? attachAttributions(toBlocks(childNodes(document))) : [];
}

function blockText(block: ArticleBlock): readonly string[] {
	switch (block.kind) {
		case 'paragraph':
		case 'heading':
		case 'caption':
			return block.runs.map((run) => run.text);
		case 'list':
			return block.items.flatMap((item) => item.flatMap(blockText));
		case 'quote':
			return block.blocks.flatMap(blockText);
		case 'table':
			return block.rows.flatMap((row) => row.flatMap((cell) => cell.blocks.flatMap(blockText)));
		case 'collapsible':
			return block.items.flatMap((item) => [...item.title.map((run) => run.text), ...item.body.flatMap(blockText)]);
		case 'code':
			return [block.text];
		default:
			return [];
	}
}

export function blocksText(blocks: readonly ArticleBlock[]): string {
	return blocks.flatMap(blockText).join(' ').replace(/\s+/g, ' ').trim();
}

// A list typed in the editor as separate items: each bullet or number, or each
// plain paragraph, is one item.
export function listItemsText(blocks: readonly ArticleBlock[]): readonly string[] {
	return blocks
		.flatMap((block) => (block.kind === 'list' ? block.items.map(blocksText) : [blocksText([block])]))
		.filter((item) => item !== '');
}

export function wordCount(blocks: readonly ArticleBlock[]): number {
	const text = blocksText(blocks);
	return text === '' ? 0 : text.split(' ').length;
}

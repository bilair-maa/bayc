// Copy buttons. `data-copy` holds the text to copy, or "page-url" for the
// current page's address. The result is announced in the `[data-copy-status]`
// live region inside the button's closest `[data-copy-scope]`.
const statusResetMs = 1800;

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
	button.addEventListener('click', async () => {
		const status = button.closest('[data-copy-scope]')?.querySelector<HTMLElement>('[data-copy-status]');
		const text = button.dataset.copy === 'page-url' ? window.location.href : (button.dataset.copy ?? '');
		try {
			await navigator.clipboard.writeText(text);
			if (status) status.textContent = button.dataset.copyDone ?? 'Copied';
		} catch {
			if (status) status.textContent = 'Copying isn’t available here';
		}
		window.setTimeout(() => {
			if (status) status.textContent = '';
		}, statusResetMs);
	});
}

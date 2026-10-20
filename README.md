## Managing site content

The Directory, Leadership and News & Events pages read from Wix CMS collections. Edit them in the site's Wix dashboard under **CMS**. Changes appear on the next page load, with no code change or redeploy.

| Collection | Page | Notes |
|---|---|---|
| Members | Directory | Add only members who agreed to be listed. Never add contact details. |
| Founder | Leadership | A single entry: edit it, but it can't be duplicated. Its **Bio** is followed by a link to the founder's letter. |
| Leadership | Leadership | Pick the **Group** (Leadership Council or Advisory Council) from the dropdown. **Order** sets the position (lower first). **Full bio** appears under "Read More". |
| Statements | News & Events | Needs a title; each statement gets its own page. **Date** is optional: left empty, the statement shows the day it was published. **At a Glance** takes one key point per bullet (press Enter for the next). **Statement** is the full text; its first paragraph is set large. **Pinned** statements show at the top; without any, the three newest do. The **PDF** is optional. |
| News | News & Events | Needs a title; each story gets its own page and is dated by when it was published. **Article** is the story; its first paragraph gets a drop cap, and a line starting with a dash (— Name) right after a quote shows as who said it. |
| Events | News & Events | Upcoming events appear in the Events slideshow automatically, soonest first; finished events move to Past Events. Needs a title and **Starts** (date & time, New York time) for the countdown and "Add to calendar". **About this event** is the description. **Agenda** is free text (one paragraph per item reads best); **Speakers**: add a photo per speaker, with their name as the photo's title and their role as its description. |**Speakers**: add a photo per speaker, with their name as the photo's title and their role as its description. Tick **Paid** and enter the **Price ($)** for paid events (unticked shows Free); tick **RSVP required** to say so on the page. **RSVP link** shows an RSVP button and must start with `https://`. |

- New entries start as **Draft** and are hidden from visitors until published.
- Everything published in these collections, including uploaded photos and PDFs, is public.
- Entries missing a required value are left off the page.
- The Group dropdown's options live in **Settings: Leadership Groups**. Don't add, rename or delete them: the site only knows the ones that exist now.
- Sections with no published entries are hidden.
- **Article**, **About this event**, **Statement**, **Bio** and **Full bio** use Wix's block editor: headings, lists, quotes, tables, collapsible sections, buttons, images with captions, galleries (photos open full screen in articles), YouTube and Vimeo videos, and code. HTML and embed blocks aren't shown. Fonts, colors and sizes picked in the editor are ignored so every page matches the site's design.


## Need help?

For documentation and support, check out:

- [Wix Headless Documentation](https://dev.wix.com/docs/go-headless)
- [Wix SDK Documentation](https://dev.wix.com/docs/sdk)
- [Community on Discord](https://discord.gg/n6TBrSnYTp)
## Form submissions

Contact, Membership Application, and Stay Informed send to **Wix dashboard ? Forms & Submissions**. The schemas are named **BAYC Contact**, **BAYC Membership**, and **BAYC Stay Informed**. Field targets and validation are maintained in code; coordinate schema changes with the site code.

### Temporary operation without reCAPTCHA

Forms currently work without reCAPTCHA. Run `npm run dev`, complete a form, and check **Wix dashboard > Forms & Submissions**. JavaScript is required. Wix spam filtering, server validation, same-origin checks, the honeypot, the two-second minimum fill time, and duplicate-click protection remain active.

This temporary mode is controlled by `PUBLIC_RECAPTCHA_ENABLED`, which defaults to disabled. BAYC's site maintainer owns enabling reCAPTCHA and removing the temporary disabled mode after keys are configured and verified. No Google script or reCAPTCHA notice is shown while disabled.

### Enable reCAPTCHA when ready

1. Register a **reCAPTCHA v3 (score-based)** key in the [Google reCAPTCHA console](https://www.google.com/recaptcha/admin/create). Allow `baycusa.org`, `www.baycusa.org`, and any preview hostname you test. Add `localhost` for local testing.
2. Add these settings to your ignored local `.env.local` (replace the placeholder values; never commit the secret):

   ```dotenv
   PUBLIC_RECAPTCHA_SITE_KEY=your-public-site-key
   RECAPTCHA_SECRET_KEY=your-private-secret
   PUBLIC_RECAPTCHA_ENABLED=true
   ```

3. Restart `npm run dev`. Submit each form and confirm it reaches Wix. Missing keys or rejected CAPTCHA checks block submissions when enabled.
4. Configure the same settings for Wix hosting from your own terminal, keeping the secret private:

   ```powershell
   npm run env -- set --key PUBLIC_RECAPTCHA_SITE_KEY --value "your-public-site-key"
   npm run env -- set --key RECAPTCHA_SECRET_KEY --value "your-private-secret"
   npm run env -- set --key PUBLIC_RECAPTCHA_ENABLED --value "true"
   ```

5. Rebuild and release when ready. The enable setting and public site key are read at build time; changing environment settings alone does not update an existing deployment. Confirm all three forms on the deployed hostname.

When reCAPTCHA is enabled, the server checks the Google score (at least 0.5), action, hostname and token age with a five-second verification timeout. Google's token is verified independently; it is not passed as a Wix CAPTCHA token. Wix's `ADVANCED` spam filtering remains enabled. The schema API does not expose an always-require-CAPTCHA setting. The route also enforces same-origin JSON, a 16 KB body limit, field allowlists, a honeypot, and a two-second minimum fill time. Fast submissions receive a visible retry message. There is no shared IP rate limiter. Duplicate clicks are blocked in the browser; uncertain network outcomes are not retried automatically.

### Dashboard setup and data handling

For each form, open its dashboard settings/automations and enable **email notifications for new submissions**, choosing the owner as recipient. Confirm receipt with a test submission.

Stay Informed's Subscribe button grants consent to BAYC news and event emails; the schema maps its subscription field to email marketing. Enable **double opt-in** on that form's Subscribe field: **Edit Form ? Subscribe ? Settings ? Enable double opt-in** ([Wix instructions](https://support.wix.com/en/article/wix-forms-enabling-double-opt-in-for-subscribers)). This setting needs dashboard access and has not been enabled by this integration. When enabled, contacts remain pending until they confirm by email. Verify the resulting status in **Contacts / Email Marketing** before sending a campaign.

Review membership applications privately. Add accepted applicants to the **Members** CMS collection by hand, and only when **List Me in the Directory** is selected; nothing is published automatically. Restrict dashboard access and enable two-step verification for accounts with access. Periodically review submissions and delete those no longer needed from Forms & Submissions; also remove associated Contacts when they are no longer needed, respecting ongoing subscriptions.

Run automated form checks with `node --experimental-vm-modules --test tests/forms.test.mjs`. Tests use synthetic values and do not send submissions. Before release, verify all three forms with configured keys, keyboard navigation, a screen reader, 200% zoom and 320px reflow.

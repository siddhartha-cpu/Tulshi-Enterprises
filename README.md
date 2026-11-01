# M/S. Tulshi Enterprises — website

Static one-page site with no build step. The host must see `index.html` at the **top level**, so
always upload the **contents of `frontend/`**, never this outer folder:

- **Netlify Drop** (app.netlify.com/drop) or **Vercel Drop** (vercel.com/drop): drag in the `frontend`
  folder itself, or the ready-made `tulshi-enterprises-DEPLOY.zip` (which already has `index.html` at the top).
- **GitHub → Netlify**: `netlify.toml` already tells Netlify to publish `frontend`.
- **GitHub → Vercel**: in the project settings set **Root Directory** to `frontend`, Framework **Other**,
  no build command.
- **cPanel / Hostinger**: upload the contents of `frontend/` into `public_html`.

Security headers and redirects are set for each host: `_headers` + `_redirects` (Netlify, Cloudflare Pages),
`vercel.json` (Vercel) and `.htaccess` (Apache / cPanel).
You can also open `frontend/index.html` directly in a browser to check it.

## Before going live (one find-and-replace)

The site's address isn't known yet, so every place that needs the full web address uses the
placeholder **`https://tulshienterprises.example`** (a reserved name that can never point to anyone
else's site). Replace it with the real address, e.g. `https://www.yourdomain.in`, in these files:

`frontend/index.html`, `frontend/robots.txt`, `frontend/sitemap.xml`, `frontend/llms.txt`, `frontend/.well-known/security.txt`

Then submit `https://<your domain>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Where things live

| What | File |
| --- | --- |
| Page content | `frontend/index.html` |
| Colours, fonts, layout | `frontend/assets/css/site.css` (colour tokens at the top, one set for night, one for day) |
| Phone, email, WhatsApp, **social links**, form delivery | `frontend/assets/js/config.js` |
| Projects and photo captions | `frontend/assets/js/projects.js` |
| Behaviour (lamp, viewer, services, quote form, assistant) | `frontend/assets/js/site.js` |
| Saved day/night mode (runs before the page paints) | `frontend/assets/js/mode.js` |
| Project photos | `frontend/gallery/img/` (full size) and `frontend/gallery/thumbs/` (small copies) |
| Share image and app icons | `frontend/assets/img/og-image.jpg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |

Page sections: hero (day/night lamp) → About (with the "From pit to switch-on" stage carousel)
→ Field execution (projects as sideways slides) → Gallery (every photo, filter by project)
→ What we build (services list; on laptops the chosen service shows beside the list, on phones a tap
opens the details; the string of bulbs lights up in night mode) → Quotation form.

## Assistant

The round button in the bottom-left is the assistant: an animated site engineer (original illustration)
who blinks, nods and moves his mouth while he answers. There is no typing: visitors tap options, and he
replies in text and out loud. The speaker button in his header turns the voice off or on, and the choice
is remembered.

Options: Get a quotation (pick the work, then open the form with it ticked, or WhatsApp), Our services
(each service explained, with "Get a quote for this" and "Show full details"), Our projects (opens the
photos), Office address (Google Maps, call the office) and Something else (call either number, WhatsApp
or email). Everything comes from `config.js`, `projects.js` and the service list in `site.js`, and runs in
the visitor's browser; nothing is sent to an outside service.

## Search engines and AI assistants

- Title, description, canonical link, Open Graph / X share tags and a 1200×630 share image.
- Structured data (JSON-LD in `index.html`): the business, its services, contact points, service area
  and the completed projects, so Google and AI assistants can read them reliably.
- `robots.txt` allows all search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others).
- `sitemap.xml` lists the page and all 78 project photos (image sitemap).
- `llms.txt` is a plain summary of the business for AI tools.
- When scripts are off (many crawlers), the projects still appear as a plain list.
- AI browser agents: the quotation form carries WebMCP tool attributes, and the page offers read-only
  tools (contact details, services, projects) in browsers that support `navigator.modelContext`.
  WebMCP is still experimental; elsewhere this is ignored.
- If you add a project to `projects.js`, also add it to the JSON-LD project list, the `<noscript>` list
  in `index.html`, `llms.txt` and `sitemap.xml`.

## Security

- A strict Content Security Policy only allows the site's own scripts, styles, fonts and images, plus
  sending the form to FormSubmit. Injected or third-party scripts are blocked. It is set in
  `index.html` and, more strongly, as a server header.
- Server headers: `frontend/_headers` (Netlify, Cloudflare Pages), `frontend/vercel.json` (Vercel) and `frontend/.htaccess`
  (Apache, cPanel, Hostinger) add HTTPS-only (HSTS), no framing (clickjacking), no MIME sniffing,
  a strict referrer policy and disabled camera/microphone/location. `.htaccess` also forces HTTPS,
  hides directory listings and blocks hidden files.
- Old `gallery.html` links redirect to the Gallery section (`_redirects` / `.htaccess`).
- The quote form limits input lengths, checks phone/email, and has a hidden field that catches spam bots.
  Social links in `config.js` are only used if they start with `https://`.
- `/.well-known/security.txt` tells security researchers how to report a problem.
- `404.html` is shown for missing pages.

## Quotation form → email (one-time setup)

The form sends requests to **tulshienterprises21@gmail.com** through FormSubmit
(free, no account). After the site is live:

1. Submit one test request from the live website.
2. FormSubmit emails an **"Activate Form"** message to tulshienterprises21@gmail.com. Click **Activate** once.
3. Every request after that arrives in the inbox as a table (name, phone, email, categories, site, scope).

If the email service is unreachable, visitors are offered "Send by email" and
"Send on WhatsApp" with their details already filled in.

## Social media icons

LinkedIn, Facebook and Instagram icons show in the contact section and the footer (not in the header, as on most company sites).
**They currently point to each site's home page.** Paste the company's real profile links into `social`
in `frontend/assets/js/config.js` and every icon updates. YouTube and Vimeo icons appear only when their links are filled in.

## Adding a project

1. Put the photos in `frontend/gallery/img/` as `photo-79.jpg`, `photo-80.jpg`, …
2. Make a small copy of each (about 640 px on the long side) in `frontend/gallery/thumbs/` with the same name.
3. Copy one project block in `frontend/assets/js/projects.js`, give it a new `id`, and list its photos.
   `tags` link the project to services (`street`, `highmast`, `lines`, `substation`, `civil`, `cabling`, `panels`, `maintenance`, `poles`)
   so it shows up under "Where we've done it" in that service's details. `short` is the name on the Gallery filter button.
4. The project gets its own slide, filmstrip thumbnail and Gallery filter automatically.

## Colour theme

Each mode follows the "base + one supporting colour + one accent" rule:

| | Night mode | Day mode |
| --- | --- | --- |
| Base | Midnight Black `#030407` | Warm Beige `#EDECE6` |
| Text | `#F2F5FA` | Deep ink `#12142B` |
| Supporting colour | Electric Cobalt `#1558C9` (sky glow, icons) | Cobalt Blue `#1546D9` (buttons, italic headline line, links) |
| Accent (used sparingly) | Acid Lime `#D4FF24` (buttons, italic headline line) | Sun Yellow `#F9B318` (the sun, selected items, icon circles, small rules) |

The light-mode footer is a deeper warm beige `#E2DFD5`.
The lamp, street lights and bulbs keep their warm amber light in both modes. Every text and button
colour pair meets WCAG AA contrast. All colours are tokens in the `@PALETTE-START` block near the top
of `frontend/assets/css/site.css`.

Headings use Playfair Display (upright, with the italic for the accent line); body text uses Barlow.
The hero is centred under a small hanging lamp; pull its chain or use the switch in the header
(beside "Get a quote" on laptops, beside the menu button on phones) to change modes.

## Fonts

Barlow, Barlow Condensed and Playfair Display (upright and italic, for headings) are self-hosted in `frontend/assets/fonts/` (SIL Open Font License), so the site doesn't depend on Google Fonts.

# M/S. Tulshi Enterprises — website

One-page website plus an **admin portal** at `/admin` for posting new projects and gallery photos.

## Deploying on Netlify

This folder is the whole project: the website files are at the top level, and the admin portal's
server part is in `netlify/functions`.

**Netlify Drop (easiest)**
1. Sign in at app.netlify.com first. This matters: when you're signed in, Netlify builds the project, which
   switches on the admin portal. Without signing in, only the website goes up and `/admin` says it isn't switched on.
2. Go to **app.netlify.com/drop** and drag in `tulshi-enterprises-netlify.zip` (or this folder).
3. Open `https://<your site>.netlify.app/admin` to check it.

**Updating later:** in Netlify open your project → **Deploys** and drag the new zip or folder there, so the
same site is updated. Don't drop it as a new project: posts made in the admin portal belong to the site
they were posted on, and a new project starts empty.

**From GitHub (optional):** put this folder in a repository and choose **Add new project → Import an existing
project → GitHub**. `netlify.toml` already has all the settings.

What Netlify does: installs the two small packages in `package.json`, runs `build.mjs` (copies only the
website into `dist`, which is what visitors see) and packages `netlify/functions/api.mjs` as the server.
Server code, package files and this README are never published; `_redirects` also blocks them if the folder
is ever uploaded without a build. Posts made in the admin portal are kept in Netlify's storage (Netlify Blobs),
not in the files, so new deploys never remove them.

Other hosts (website only, no admin portal): Vercel Drop, or cPanel / Hostinger `public_html`. Upload
everything except `netlify/`, `package.json`, `package-lock.json`, `netlify.toml`, `build.mjs` and this README.
Security headers are set for each host: `_headers` (Netlify), `vercel.json` (Vercel) and `.htaccess` (Apache / cPanel).

## Admin portal (`/admin`)

**Sign in:** username `admin`, password `admin123` (all small letters).

- **Projects tab → Post a new project:** project name, location, client (optional), key facts (optional,
  separated by commas), type of work, a few words about the project, and photos — each photo with its
  own caption. Tap **Make cover** on the photo that should be shown first, then **Post project**.
  The project appears first in *Field execution*, gets its own slides and photo viewer, a Gallery filter,
  and shows under "Where we've done it" for the types of work you picked.
- **Gallery tab → Add photos to the gallery:** site/location and type of work (both optional, used for
  all photos in that batch), a caption under each photo, then **Post to gallery**. They appear first in
  the Gallery under **Latest uploads**.
- **Everything on the website is in the admin**, including the 6 original projects and all 78 of their
  photos (marked "Original project"). They are added automatically the first time the site runs.
- **Projects on the website:** **View** opens it on the website; **Edit** loads it into the form above — change
  the name, location, client, facts, type of work or description, edit any photo caption, remove photos, add
  new ones, pick a new cover — then **Save changes** (or **Cancel editing**); **Delete** asks for a second tap.
- **Deleted an original project by mistake?** A box appears above the list with **Bring them back**; it puts
  them back in their old place with all their photos.
- **Gallery tab → Gallery photos on the website:** the latest uploads first, then every photo of every
  project, grouped by project. Each has **Edit caption** and **Delete**. Deleting a project photo removes it
  from that project too; a project's last photo can't be deleted this way (delete the project instead).
- Changes are saved one at a time: while one is saving, the lists dim and wait. If the same project was
  changed in another tab a moment earlier, the save is refused and the page refreshes, so nothing is
  overwritten by an older copy.
- Photos are resized in the browser before upload (about 1800 px on the long side, plus a small copy for
  thumbnails), so large phone photos post quickly. JPG and PNG work; up to 40 photos per project and 30 per gallery post.
- If the site is ever uploaded without its server part, it shows the original projects from `projects.js`.

**Changing the username or password:** Netlify → your project → **Project configuration → Environment
variables** → add `ADMIN_USERNAME` and/or `ADMIN_PASSWORD`, then deploy again (drag the zip onto **Deploys**). Changing them
signs everyone out. `admin123` is easy to guess, so changing it before sharing the site address widely
is recommended.

**How it is protected:** the password is checked on the server, never in the page; after 5 wrong tries
that device has to wait 15 minutes; a signed-in session lasts 12 hours in a secure, script-proof cookie;
posting and deleting only work from the admin page itself (other sites can't trigger them); uploads must
be real JPEG photos under 4 MB; all captions are shown as plain text, so typed code can never run; and
`/admin` is hidden from search engines.

Server code: `netlify/functions/api.mjs` (routes under `/api/`). Admin page: `admin/index.html`,
`assets/js/admin.js`, `assets/css/admin.css`.

## Before going live (one find-and-replace)

The site's address isn't known yet, so every place that needs the full web address uses the
placeholder **`https://tulshienterprises.example`** (a reserved name that can never point to anyone
else's site). Replace it with the real address, e.g. `https://www.yourdomain.in`, in these files:

every `.html` page, `robots.txt`, `sitemap.xml`, `llms.txt`, `.well-known/security.txt`

Then submit `https://<your domain>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Where things live

The site uses the same layout, colours and fonts as the Shine Wave Electra website (Bootstrap theme),
filled with Tulshi Enterprises content.

| What | File |
| --- | --- |
| Pages | `index.html`, `about.html`, `services.html`, `projects.html`, `gallery.html`, `clientele.html`, `contact.html`, `business_enquiry.html`, `404.html` |
| Base layout styles | `css/theme.css` (trimmed from the Shine Wave theme to only what the pages use) and `css/fonts.css` |
| Tulshi design (colours, logo, hero, cards, photo viewer, form) | `css/tulshi.css` |
| Menu, hero slider, photo viewer, back-to-top | `js/site.js` (no libraries) |
| Projects, gallery, enquiry form, WhatsApp number | `js/tulshi.js` (and `js/enquiry-pdf.js` for the enquiry PDF) |
| Built-in projects and photo captions | `assets/js/projects.js` |
| Projects and gallery photos posted later | the admin portal at `/admin` (stored in Netlify Blobs) |
| Logo | drawn in each page (symbol + name); original artwork in `images/logo.png`; app icons and share image in `assets/img/` |
| Theme photos (banners, service cards, icons) | `images/` (`abouti.png` and `servmnp.jpg` are collages of Tulshi site photos) |
| Project photos | `gallery/img/` (full size) and `gallery/thumbs/` (small copies) |
| Admin portal styles | `assets/css/site.css`, `assets/css/admin.css` |

The header, footer and all pages are produced from one script, so the header and footer are the same on
every page. If you edit a page by hand, edit the header and footer on every page in the same way.

## Search engines and AI assistants

- Title, description, canonical link, Open Graph / X share tags and a 1200×630 share image.
- Structured data (JSON-LD in `index.html`): the business, its services, contact points, service area
  and the completed projects, so Google and AI assistants can read them reliably.
- `robots.txt` allows all search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others).
- `sitemap.xml` lists every page and all 78 project photos (image sitemap).
- `llms.txt` is a plain summary of the business for AI tools.
- AI browser agents: the business enquiry form carries WebMCP tool attributes (experimental; ignored elsewhere).
- If you add a project to `projects.js`, also add it to the JSON-LD project list in `index.html`, `llms.txt` and `sitemap.xml`.

## Security

- A strict Content Security Policy only allows the site's own scripts, styles, fonts and images, plus
  sending the form to FormSubmit. Injected or third-party scripts are blocked. It is set in
  `index.html` and, more strongly, as a server header.
- Server headers: `_headers` (Netlify, Cloudflare Pages), `vercel.json` (Vercel) and `.htaccess`
  (Apache, cPanel, Hostinger) add HTTPS-only (HSTS), no framing (clickjacking), no MIME sniffing,
  a strict referrer policy and disabled camera/microphone/location. `.htaccess` also forces HTTPS,
  hides directory listings and blocks hidden files.
- Old one-page links such as `/#gallery` or `/#project-naraj` are forwarded to the matching page.
- The enquiry form limits input lengths and checks the phone number and email; it sends nothing on its own
  (the visitor sends it from WhatsApp or their email app), so the site makes no outside network requests.
- `/.well-known/security.txt` tells security researchers how to report a problem.
- `404.html` is shown for missing pages.

## Business enquiry form: PDF, then WhatsApp or email

There is no outside form service any more. On the Business Enquiry page the visitor fills in the form and
presses **Submit enquiry**. The page then:

1. Makes a PDF of the details in the visitor's browser (`js/enquiry-pdf.js`: company header and logo,
   reference number, date, every field, and the company's contact details at the bottom). Nothing is
   uploaded anywhere.
2. Asks how to send it:
   - **Send on WhatsApp** opens a chat with **+91 92371 01021** with all the details already typed in,
     and saves the PDF to the visitor's Downloads so they can attach it.
   - **Send by email** opens the visitor's own email app with a message to **tulshienterprises21@gmail.com**
     (subject and all details filled in), saves the PDF so they can attach it, and offers Gmail in the
     browser for people without an email app.

Websites are not allowed to attach a file to a WhatsApp chat or an email by themselves, so the visitor
attaches the saved PDF with one tap (the dialog shows them how). The message itself already contains every
detail, so nothing is lost if they forget. The WhatsApp number and email address are at the top of
`js/tulshi.js` (`WA_NUMBER`, `EMAIL`).

## Social media icons

Facebook, Instagram and LinkedIn icons show in the footer and on the Contact page.
**They currently point to each site's home page.** Replace `https://www.facebook.com/`,
`https://www.instagram.com/` and `https://www.linkedin.com/` with the company's real profile links in every page.

## Adding a project by hand (without the admin portal)

The admin portal is the easy way. To make a project part of the website's own files instead (after this,
run `node build.mjs` or just deploy; a new project then appears in the admin automatically, but changes to
an existing original project made here are ignored once the admin has it — edit those in the admin):

1. Put the photos in `gallery/img/` as `photo-79.jpg`, `photo-80.jpg`, …
2. Make a small copy of each (about 640 px on the long side) in `gallery/thumbs/` with the same name.
3. Copy one project block in `assets/js/projects.js`, give it a new `id`, and list its photos.
   `tags` link the project to services (`street`, `highmast`, `lines`, `civil`, `cabling`, `panels`, `maintenance`, `poles`)
   and show as "Work" on the project card. `short` is the name on the Gallery filter button.
4. The project gets its own card on the Projects page and its own Gallery filter automatically.

## Colour theme and design

The page structure started from the Shine Wave Electra site, but the look is Tulshi's own: a hero with a
navy shade over the photo and the text on the left, a "foundation, erection, switch-on" photo strip in the
About band, section headings underlined with a short cable and plug taken from the logo, and plain service
cards. The logo is drawn in the page (the symbol is an SVG in each page, the name is text), so it stays sharp
and turns white on dark backgrounds; `images/logo.png` is the original logo, kept for reference.

Colours (the `:root` variables at the top of `css/tulshi.css`):

| Name | Hex | Used for |
| --- | --- | --- |
| Logo navy | `#031685` | headings, links, the logo symbol |
| Deep navy | `#0B1552` | About band, footer, dark boxes |
| Logo orange | `#F85C06` | company name, accents, headings in the footer |
| Button orange | `#E04F00` | buttons and the Business Enquiry button (white text stays readable) |
| Red / green | `#E3261C` / `#16A34A` | the plugs in the logo symbol and small ticks only |
| Light tint | `#F3F5FC` | light section backgrounds |

The admin portal's colours are the tokens at the top of `assets/css/site.css`.

## Fonts

Roboto, Roboto Condensed and Kanit are self-hosted in `fonts/`
(SIL Open Font License, declared in `css/fonts.css`), so the site doesn't depend on Google Fonts.

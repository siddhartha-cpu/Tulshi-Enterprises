# M/S. Tulshi Enterprises — website

Website of **M/S. Tulshi Enterprises**, a civil and MV electrical contractor and general order supplier in Cuttack, Odisha.

**Live site:** https://tulshienterprises.netlify.app

Street lighting, high masts, MV & LT lines, RCC foundations, underground cabling, feeder pillars and junction boxes, repair and maintenance, and pole and material supply across Odisha and West Bengal. Registered with the Government of Odisha, CPWD, Indian Railways, HAL and MCL.

## Pages

| Page | File |
|---|---|
| Home | `index.html` |
| Who We Are | `about.html` |
| What We Do (8 services) | `services.html` |
| Our Work (projects) | `projects.html` |
| Site Photos | `gallery.html` |
| Our Clients and registrations | `clientele.html` |
| Reach Us | `contact.html` |
| Get a Quote (enquiry form) | `business_enquiry.html` |
| Admin portal | `admin/` |

## What the site does

- **Enquiry form.** Builds a PDF of the enquiry in the visitor's browser, then sends it by WhatsApp (+91 92371 01021) or by email (tulshienterprises21@gmail.com). Nothing is stored on a server.
- **Admin portal** at `/admin`. Add, edit and delete projects and site photos; they appear on Our Work and Site Photos. Runs on Netlify Functions (`netlify/functions/api.mjs`) and stores its data in Netlify Blobs.
- **SEO.** Each page has its own title, description and keywords, Open Graph and Twitter tags, and schema.org data for the business, its services and breadcrumbs. Also included: `sitemap.xml` (pages and photos), `robots.txt` and `llms.txt`.
- **Speed.** Images are right-sized WebP. There is one minified stylesheet and the scripts are minified and deferred. Fonts are self-hosted, with fallbacks sized to match. The projects and gallery content is built into the HTML.

## Folder layout

```
*.html                 the pages
css/fonts.css          self-hosted fonts (Kanit, Roboto Condensed, Roboto)
css/theme.css          base theme styles
css/tulshi.css         the site's own design layer (edit this one)
css/site.min.css       what the pages load: built from the three files above
js/site.js             menu, photo row, photo viewer, back-to-top
js/tulshi.js           projects, gallery and the enquiry form
js/enquiry-pdf.js      the PDF writer for enquiries
js/*.min.js            what the pages load: minified copies
assets/js/projects.js  the original projects and their photos
gallery/img, thumbs    site photos (WebP)
images/                photos and logos; images/opt holds right-sized WebP copies
admin/                 admin portal page (assets/js/admin.js, assets/css/admin.css)
netlify/functions/     admin portal server
build.mjs              Netlify build step: copies the website into dist/
dev-tools/             maintenance tools, not published with the site
```

## Making changes

1. Edit the page (`*.html`), `css/tulshi.css` or `js/*.js`.
2. Rebuild the minified files, the baked-in projects and gallery, and the sitemap:

   ```
   pip install pillow
   npm i --no-save purgecss@6 esbuild@0.24 playwright && npx playwright install chromium
   python3 dev-tools/build-assets.py
   ```

3. Check it locally:

   ```
   npm install
   npx netlify dev --port 8888
   node dev-tools/check.cjs /tmp/shots
   ```

   `check.cjs` opens every page at laptop and phone width. It reports script errors, missing files and sideways scrolling, and saves screenshots.

## Deploying

The site is hosted on Netlify. `netlify.toml` runs `node build.mjs`, publishes `dist/` and packages the admin server from `netlify/functions`.

The admin portal signs in with these Netlify environment variables (Project configuration → Environment variables). They are set on the live site; their values are never stored in this repository, and there is no built-in default password: without `ADMIN_PASSWORD` nobody can sign in. Redeploy after changing them.

| Variable | Purpose |
|---|---|
| `ADMIN_USERNAME` | admin sign-in name |
| `ADMIN_PASSWORD` | admin password (choose a strong one) |
| `ADMIN_SESSION_SECRET` | any long random text; keeps sign-ins secure |

## Contact

M/S. Tulshi Enterprises, Plot No. 6D/1477, Malati Bhawan, Ground Floor, Sector-10, CDA, Cuttack, Odisha 753014
Phone: +91 97489 82015, +91 92371 01022, +91 92371 01021 · Email: tulshienterprises21@gmail.com

---

Developed by [TDW — The Digital Workspace](https://thedigitalworkspace.in/).

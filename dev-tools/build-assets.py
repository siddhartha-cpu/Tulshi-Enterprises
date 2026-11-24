# Second half of the rebuild: one minified stylesheet, baked-in projects/gallery, sitemap and site files, clean-up.
# Run from the repository root after editing any page, css/*.css or js/*.js:
#   python3 dev-tools/build-assets.py
# Needs: pip install pillow; npm i --no-save purgecss@6 esbuild@0.24 playwright (and npx playwright install chromium)
import hashlib, json, os, re, subprocess, sys, glob, datetime
from PIL import Image

SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
DOMAIN = 'https://tulshienterprises.netlify.app'
TOOLS = os.environ.get('TOOLS_BIN', os.path.join(SITE, 'node_modules/.bin/'))
P = lambda *a: os.path.join(SITE, *a)
rd = lambda p: open(P(p), encoding='utf-8').read()


def wr(p, s):
    open(P(p), 'w', encoding='utf-8').write(s)


import tempfile
PURGED = tempfile.mkdtemp()
PAGES = sorted(f for f in os.listdir(SITE) if f.endswith('.html'))

# minified scripts are refreshed too, so edits to the readable files carry through
for js in ('js/site.js', 'js/tulshi.js', 'js/enquiry-pdf.js', 'assets/js/projects.js'):
    subprocess.run([TOOLS + 'esbuild', P(js), '--minify', '--target=es2017', '--log-level=warning', '--outfile=' + P(js[:-3] + '.min.js')], check=True)
    v = hashlib.sha1(open(P(js[:-3] + '.min.js'), 'rb').read()).hexdigest()[:8]
    for f in PAGES:
        t = rd(f)
        t2 = re.sub(re.escape(js[:-3]) + r'\.min\.js\?v=[0-9a-f]+', js[:-3] + '.min.js?v=' + v, t)
        if t2 != t:
            wr(f, t2)

# ---------- one stylesheet: fonts + theme rules in use + our layer, with size-matched fallback fonts ----------
subprocess.run([TOOLS + 'purgecss', '--css', P('css/theme.css'), '--content'] + [P(f) for f in PAGES] +
               [P('js/site.js'), P('js/tulshi.js'), P('assets/js/projects.js'), P('js/enquiry-pdf.js')] +
               ['--safelist', 'mobile-menu-visible', 'is-open', 'is-on', 'open', 'active', 'current', 'show', 'sticky', 'fixed-header',
                'dropdown', 'collapse', '--output', PURGED + '/'], check=True)
FALLBACK_FACES = (
    '@font-face{font-family:"RC Fallback";src:local("Arial"),local("ArialMT"),local("Liberation Sans"),local("Helvetica"),local("Roboto");'
    'size-adjust:89.4%;ascent-override:104%;descent-override:26.8%;line-gap-override:0%}\n'
    '@font-face{font-family:"Kanit Fallback";font-weight:100 550;src:local("Arial"),local("ArialMT"),local("Liberation Sans"),local("Helvetica"),local("Roboto");'
    'size-adjust:102.6%;ascent-override:107.2%;descent-override:39%;line-gap-override:0%}\n'
    '@font-face{font-family:"Kanit Fallback";font-weight:551 900;src:local("Arial Bold"),local("Arial-BoldMT"),local("Liberation Sans Bold"),local("Helvetica Bold"),local("Roboto Bold");'
    'size-adjust:95.7%;ascent-override:115%;descent-override:41.8%;line-gap-override:0%}\n')
css = FALLBACK_FACES + rd('css/fonts.css') + '\n' + open(PURGED + '/theme.css', encoding='utf-8').read() + '\n' + rd('css/tulshi.css')
css = re.sub(r'([\'"]Roboto Condensed[\'"])\s*,', r'\1,"RC Fallback",', css)
css = re.sub(r'([\'"]Kanit[\'"])\s*,', r'\1,"Kanit Fallback",', css)
open(P('css/site.all.css'), 'w', encoding='utf-8').write(css)
subprocess.run([TOOLS + 'esbuild', P('css/site.all.css'), '--minify', '--log-level=warning', '--outfile=' + P('css/site.min.css')], check=True)
os.remove(P('css/site.all.css'))
cssv = hashlib.sha1(open(P('css/site.min.css'), 'rb').read()).hexdigest()[:8]
for f in PAGES:
    t = re.sub(r'css/site\.min\.css\?v=(__CSSV__|[0-9a-f]{8})', 'css/site.min.css?v=' + cssv, rd(f))
    wr(f, t)
print('css', os.path.getsize(P('css/site.min.css')), 'bytes')

# ---------- bake the built-in projects and gallery into their pages ----------
env = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())
subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prerender.cjs'), SITE], check=True, env=env)

# ---------- sitemap ----------
opt_imgs = sorted(glob.glob(P('images/opt/*.webp')))
rel = lambda f: os.path.relpath(f, SITE)
pick = lambda pat: [rel(f) for f in opt_imgs if re.search(pat, os.path.basename(f))]
TODAY = datetime.date.today().isoformat()
pages = [('', '1.0', 'weekly', ['assets/img/og-image.jpg'] + pick(r'^(hero-.*|svc-(cabling|civil|poles))-480\.webp$')),
         ('about.html', '0.8', 'monthly', pick(r'^about-circle-900')),
         ('services.html', '0.9', 'monthly', pick(r'^(svc-[a-z]+|gallery-img-photo-\d+|solr\d+)-900\.webp$') + pick(r'^svc-hex-1536')),
         ('projects.html', '0.9', 'weekly', []),
         ('gallery.html', '0.7', 'weekly', ['gallery/img/' + f for f in sorted(os.listdir(P('gallery/img'))) if f.endswith('.webp')]),
         ('clientele.html', '0.7', 'monthly', pick(r'^regs-')),
         ('contact.html', '0.8', 'yearly', []),
         ('business_enquiry.html', '0.8', 'yearly', [])]
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
for loc, pri, freq, imgs in pages:
    sm.append('  <url>\n    <loc>%s/%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>' % (DOMAIN, loc, TODAY, freq, pri))
    sm += ['    <image:image><image:loc>%s/%s</image:loc></image:image>' % (DOMAIN, im) for im in imgs]
    sm.append('  </url>')
sm.append('</urlset>')
wr('sitemap.xml', '\n'.join(sm) + '\n')

# ---------- site files ----------
for f in ('robots.txt', 'llms.txt', 'README.md', '.well-known/security.txt'):
    if os.path.exists(P(f)):
        wr(f, rd(f).replace('https://tulshienterprises.example', DOMAIN))
m = json.loads(rd('site.webmanifest'))
m.update(name='M/S. Tulshi Enterprises', short_name='Tulshi', background_color='#FFFFFF', theme_color='#0B1552',
         description='Civil and MV electrical contractor and general order supplier in Cuttack, Odisha: street lighting, high masts, MV & LT lines, cabling and RCC foundations.')
wr('site.webmanifest', json.dumps(m, indent=2, ensure_ascii=False))
h = rd('_headers')
h = h.replace('/css/*\n  Cache-Control: public, max-age=3600', '/css/*\n  Cache-Control: public, max-age=31536000, immutable')
h = h.replace('/js/*\n  Cache-Control: public, max-age=3600', '/js/*\n  Cache-Control: public, max-age=31536000, immutable')
if '/images/opt/*' not in h:
    h = h.rstrip('\n') + '\n/images/opt/*\n  Cache-Control: public, max-age=31536000\n/sitemap.xml\n  Cache-Control: public, max-age=3600\n'
wr('_headers', h)

# ---------- remove images nothing uses any more ----------
for f in ['images/banner26.jpg', 'images/banner3.jpg', 'images/bar.png', 'images/pdr1.jpg', 'images/pdr8.jpg', 'images/pdrh2.jpg',
          'images/pdrh5.jpg', 'images/solr33.jpg', 'images/svc-hex-800.jpg', 'images/why-waves.jpg', 'images/about-main.jpg',
          'images/about-inset.jpg', 'images/svc-main.jpg', 'images/svc-inset.jpg'] + [rel(x) for x in glob.glob(P('gallery/*/*.jpg'))]:
    if os.path.exists(P(f)):
        os.remove(P(f))
print('done')

/* Tulshi Enterprises: makes a PDF of a business enquiry in the browser.
   Plain PDF 1.4 with the built-in Helvetica fonts, so nothing is downloaded or sent anywhere.
   Usage: TulshiPDF.enquiry({ ref, date, phone, rows: [[label, value], ...] }) returns a Blob. */
(function () {
  'use strict';
  // Helvetica and Helvetica-Bold widths (1/1000 em) for character codes 32..255, WinAnsi encoding
  var W = { F1: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500], F2: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556] };
  // Unicode characters that WinAnsi stores in 128..159
  var EXTRA = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142,
    0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };

  function toWin(str) {
    var out = '';
    str = String(str == null ? '' : str).replace(/₹/g, 'Rs.').replace(/\r\n?/g, '\n');
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c === 10 || (c >= 32 && c < 127) || (c >= 160 && c <= 255)) out += String.fromCharCode(c);
      else if (EXTRA[c]) out += String.fromCharCode(EXTRA[c]);
      else if (c === 9) out += ' ';
      else if (c >= 0xD800 && c <= 0xDBFF) { i++; out += '?'; }
      else out += '?';
    }
    return out;
  }
  function width(s, font, size) {
    var t = 0, tbl = W[font];
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); t += (c >= 32 && c <= 255) ? tbl[c - 32] : 500; }
    return t * size / 1000;
  }
  function wrap(text, font, size, max) {
    var lines = [];
    toWin(text).split('\n').forEach(function (para) {
      var words = para.split(/ +/), line = '';
      words.forEach(function (wd) {
        var tryLine = line ? line + ' ' + wd : wd;
        if (width(tryLine, font, size) <= max) { line = tryLine; return; }
        if (line) lines.push(line);
        while (width(wd, font, size) > max) { // a single word longer than the line
          var k = wd.length;
          while (k > 1 && width(wd.slice(0, k), font, size) > max) k--;
          lines.push(wd.slice(0, k)); wd = wd.slice(k);
        }
        line = wd;
      });
      lines.push(line);
    });
    return lines;
  }
  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return (v / 255).toFixed(3); }).join(' ');
  }
  function f(n) { return String(Math.round(n * 100) / 100); }

  var NAVY = '#0B1552', LOGO_NAVY = '#031685', ORANGE = '#F85C06', RED = '#E3261C', GREEN = '#16A34A',
      INK = '#1B2140', MUTED = '#5B6386', LINE = '#DADFF0', TINT = '#F3F5FC';
  var PW = 595.28, PH = 841.89, M = 48;

  function Page() { this.ops = []; }
  Page.prototype.fill = function (hex) { this.ops.push(rgb(hex) + ' rg'); return this; };
  Page.prototype.stroke = function (hex) { this.ops.push(rgb(hex) + ' RG'); return this; };
  Page.prototype.rect = function (x, y, w, h) { this.ops.push(f(x) + ' ' + f(y) + ' ' + f(w) + ' ' + f(h) + ' re f'); return this; };
  Page.prototype.line = function (x1, y1, x2, y2, lw) { this.ops.push(f(lw || 0.6) + ' w ' + f(x1) + ' ' + f(y1) + ' m ' + f(x2) + ' ' + f(y2) + ' l S'); return this; };
  Page.prototype.text = function (x, y, s, font, size, hex) {
    this.ops.push('BT /' + font + ' ' + f(size) + ' Tf ' + rgb(hex) + ' rg ' + f(x) + ' ' + f(y) + ' Td (' + esc(s) + ') Tj ET');
    return this;
  };
  // the logo symbol, same drawing as on the website (its own units have y pointing down)
  Page.prototype.mark = function (x, y, h, ringHex) {
    var s = h / 100, o = this.ops, k = 0.5523 * 40;
    o.push('q ' + f(s) + ' 0 0 ' + f(-s) + ' ' + f(x + 8 * s) + ' ' + f(y + 108 * s) + ' cm');
    o.push(rgb(ringHex) + ' RG 7 w');
    o.push('58 22 m ' + f(58 + k) + ' 22 98 ' + f(62 - k) + ' 98 62 c 98 ' + f(62 + k) + ' ' + f(58 + k) + ' 102 58 102 c ' +
           f(58 - k) + ' 102 18 ' + f(62 + k) + ' 18 62 c 18 ' + f(62 - k) + ' ' + f(58 - k) + ' 22 58 22 c S');
    o.push(rgb(ringHex) + ' rg 29 11 58 9 re f 53 17 10 89 re f');
    o.push('1 J 1 j');
    o.push(rgb(RED) + ' RG 42 30 m 42 70 l 42 80.67 37 86 27 86 c 15 86 l S');
    o.push(rgb(RED) + ' rg 1 77 14 18 re f -6 80 8 3.5 re f -6 88 8 3.5 re f');
    o.push(rgb(GREEN) + ' RG 75 30 m 75 70 l 75 80.67 80 86 90 86 c 102 86 l S');
    o.push(rgb(GREEN) + ' rg 102 77 14 18 re f 114 80 8 3.5 re f 114 88 8 3.5 re f');
    o.push('Q');
    return this;
  };

  function build(pages) {
    var objs = [];
    function add(body) { objs.push(body); return objs.length; }
    var catalog = add(''), pagesObj = add('');
    var f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var kids = [];
    pages.forEach(function (pg) {
      var content = pg.ops.join('\n');
      var c = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      kids.push(add('<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 ' +
        f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>'));
    });
    objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>';
    objs[pagesObj - 1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    var info = add('<< /Title (Business enquiry - M/S. Tulshi Enterprises) /Producer (Tulshi Enterprises website) >>');
    var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [];
    objs.forEach(function (body, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function enquiry(d) {
    var pages = [], pg, y;
    var contact = 'Phone: +91 97489 82015, +91 92371 01022, +91 92371 01021     Email: tulshienterprises21@gmail.com';
    var address = 'Plot No. 6D/1477, Malati Bhawan, Ground Floor, Sector-10, CDA, Cuttack, Odisha - 753014';
    function footer(p, n) {
      p.stroke(LINE).line(M, 62, PW - M, 62, 0.8);
      p.text(M, 46, contact, 'F1', 8.2, MUTED);
      p.text(M, 34, address, 'F1', 8.2, MUTED);
      p.text(PW - M - width('Page ' + n, 'F1', 8.2), 34, 'Page ' + n, 'F1', 8.2, MUTED);
    }
    function newPage(first) {
      pg = new Page(); pages.push(pg);
      if (first) {
        pg.fill(NAVY).rect(0, PH - 104, PW, 104);
        pg.fill(ORANGE).rect(0, PH - 108, PW, 4);
        pg.mark(M - 4, PH - 88, 66, '#FFFFFF');
        pg.text(M + 86, PH - 48, 'M/S. TULSHI ENTERPRISES', 'F2', 21, ORANGE);
        pg.text(M + 86, PH - 67, 'Electrical Contractor & General Order Supplier', 'F1', 10.5, '#FFFFFF');
        pg.text(M + 86, PH - 83, 'Registered with Govt. of Odisha, CPWD, Indian Railways, HAL and MCL', 'F1', 8.6, '#C9D0EE');
        y = PH - 150;
        pg.text(M, y, 'Business Enquiry', 'F2', 20, LOGO_NAVY);
        var meta = toWin('Reference ' + d.ref + '     ' + d.date);
        pg.text(PW - M - width(meta, 'F1', 9.5), y + 3, meta, 'F1', 9.5, MUTED);
        y -= 30;
      } else {
        pg.fill(NAVY).rect(0, PH - 40, PW, 40);
        pg.text(M, PH - 25, toWin('M/S. TULSHI ENTERPRISES    Business Enquiry ' + d.ref + ' (continued)'), 'F2', 10, '#FFFFFF');
        y = PH - 72;
      }
      footer(pg, pages.length);
    }
    newPage(true);
    var VX = M + 150, VW = PW - M - VX - 10;
    d.rows.forEach(function (row, idx) {
      var lines = wrap(row[1] || '-', 'F1', 11, VW), i = 0;
      while (i < lines.length) {
        var room = Math.floor((y - 100) / 16);
        if (room < 1) { newPage(false); continue; }
        var take = lines.slice(i, i + room), h = take.length * 16 + 14;
        if (idx % 2 === 0) pg.fill(TINT).rect(M, y - h + 12, PW - 2 * M, h);
        if (i === 0) pg.text(M + 10, y - 3, toWin(row[0]), 'F2', 9.8, LOGO_NAVY);
        for (var k = 0; k < take.length; k++) pg.text(VX, y - 3 - k * 16, take[k], 'F1', 11, INK);
        y -= h; i += take.length;
      }
    });
    y -= 20;
    if (y < 120) newPage(false);
    pg.fill(ORANGE).rect(M, y - 6, 3, 30);
    pg.text(M + 12, y + 12, 'Sent from the business enquiry form on the Tulshi Enterprises website.', 'F1', 9.5, MUTED);
    pg.text(M + 12, y - 2, toWin('We will call you on ' + (d.phone || 'the number above') + ' to discuss the work.'), 'F1', 9.5, MUTED);
    var lossy = d.rows.some(function (r) { return toWin(r[1]).replace(/\?/g, '').length !== String(r[1] || '').replace(/\u20B9/g, 'Rs.').replace(/\?/g, '').replace(/[\uD800-\uDBFF]/g, '').length; });
    if (lossy) pg.text(M + 12, y - 16, 'Text typed in Hindi, Odia or another script shows as ? here; it is complete in the WhatsApp message or email.', 'F1', 8.6, MUTED);
    return build(pages);
  }

  window.TulshiPDF = { enquiry: enquiry };
})();

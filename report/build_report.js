/**
 * Builds the LY Innovation-Based Major Project-B report (KJSIT format) as DOCX.
 *
 *   cd report && npm install && npm run build
 *
 * Formatting rules from "Major Project B Report Format SEM VII 26-27":
 *   Times New Roman · Heading 16 / Sub-heading 14 / text 12 · line spacing 1.5
 *   justified text · margins Left 1.5", others 1" · A4
 *
 * Page numbers in CONTENTS / LIST OF FIGURES / LIST OF TABLES are read from
 * pages.json, produced by extract_pages.py from a rendered PDF (two passes).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType,
  WidthType, BorderStyle, ShadingType, PageNumber, NumberFormat, Footer, HeadingLevel, TabStopType,
  LevelFormat, VerticalAlign, PageBreak, TableLayoutType, LineRuleType,
} = require('docx');

const FIG = path.join(__dirname, 'figures');
const PAGES = fs.existsSync(path.join(__dirname, 'pages.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'pages.json'), 'utf8')) : {};
const META = require('./content/meta');
const REFS = require('./content/references');
const CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => require(`./content/ch${n}`));

// ------------------------------------------------------------------ units
const IN = 1440;
const PAGE_W = 11906; // A4 in DXA
const PAGE_H = 16838;
const MARGIN = { left: 1.5 * IN, right: IN, top: IN, bottom: IN };
const TEXT_W = PAGE_W - MARGIN.left - MARGIN.right; // 8306 DXA ~ 5.77"
const FONT = 'Times New Roman';
// Complex-script (Kannada / Devanagari) text falls back to Nirmala UI in Word
const FONTS = { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: 'Nirmala UI' };
const LINE_15 = 360; // 1.5 line spacing (240 = single)
const BLUE = '0000CC';
const FIG_SCALE = 0.66; // figures are scaled to keep the report within the 70-80 page limit
const MAX_FIG_H = 3.6; // inches
// Per-figure display size [max width, max height] in inches, chosen for legibility
const FIG_SIZES = {
  'uml_concept.png': [5.77, 1.2], 'uml_taxonomy.png': [4.6, 4.1], 'uml_usecase.png': [4.6, 4.0],
  'uml_dfd0.png': [5.5, 2.2], 'uml_dfd1.png': [4.6, 4.3], 'uml_class.png': [5.77, 3.4],
  'uml_seq_advisory.png': [5.5, 3.6], 'uml_seq_schedule.png': [5.0, 3.2], 'uml_state.png': [4.6, 3.6],
  'uml_activity_training.png': [4.6, 3.7], 'uml_activity_advisory.png': [4.6, 3.7], 'uml_component.png': [4.6, 3.2],
  'uml_deployment.png': [4.6, 2.6], 'uml_block.png': [4.6, 3.8],
  'fig_kc_ndvi.png': [5.4, 2.6], 'fig_confusion.png': [5.4, 2.6], 'fig_importance.png': [5.6, 2.4],
  'fig_scenarios.png': [5.5, 2.6], 'fig_scheduler.png': [5.5, 2.6], 'fig_loss_curve.png': [5.5, 2.6],
  'fig_pred_actual.png': [4.4, 3.6], 'fig_r2.png': [4.6, 2.6], 'fig_water_balance.png': [4.6, 2.6],
  'fig_methods.png': [4.2, 2.6], 'fig_learning_curve.png': [4.2, 2.6], 'fig_dataset_map.png': [3.9, 2.8],
};
function figSize(b) {
  if (FIG_SIZES[b.fig]) return FIG_SIZES[b.fig];
  if (b.fig.startsWith('ss_')) return [4.1, 2.9];
  return [(b.width || 5.7) * FIG_SCALE, Math.min(b.maxH || 8.0, MAX_FIG_H)];
}

// ------------------------------------------------------------------ numbering of figures / tables / equations / citations
const labels = { fig: {}, tab: {}, eq: {} };
const figList = [];
const tabList = [];
const citeOrder = [];

function preScan() {
  CHAPTERS.forEach((ch) => {
    let f = 0; let t = 0; let e = 0;
    const scanText = (s) => {
      if (typeof s !== 'string') return;
      for (const m of s.matchAll(/\{cite:([^}]+)\}/g)) {
        m[1].split(',').map((k) => k.trim()).forEach((k) => {
          if (!REFS[k]) throw new Error(`Unknown reference ${k}`);
          if (!citeOrder.includes(k)) citeOrder.push(k);
        });
      }
    };
    const walk = (b) => {
      if (b.fig) { f += 1; labels.fig[b.id || `${ch.n}.${f}`] = `${ch.n}.${f}`; figList.push({ no: `${ch.n}.${f}`, title: b.caption }); b._no = `${ch.n}.${f}`; }
      if (b.table) { t += 1; labels.tab[b.id || `${ch.n}.${t}`] = `${ch.n}.${t}`; tabList.push({ no: `${ch.n}.${t}`, title: b.caption }); b._no = `${ch.n}.${t}`; }
      if (b.eq) { e += 1; labels.eq[b.id || `${ch.n}.${e}`] = `${ch.n}.${e}`; b._no = `${ch.n}.${e}`; }
      Object.values(b).forEach((v) => {
        if (typeof v === 'string') scanText(v);
        if (Array.isArray(v)) v.forEach((x) => (Array.isArray(x) ? x.forEach(scanText) : scanText(typeof x === 'string' ? x : '')));
      });
    };
    ch.blocks.forEach(walk);
  });
  // references cited only in the literature table still get numbers (in table order)
  Object.keys(REFS).forEach((k) => { if (!citeOrder.includes(k)) citeOrder.push(k); });
}

function refNo(k) { return citeOrder.indexOf(k) + 1; }

function resolve(s) {
  return s
    .replace(/\{cite:([^}]+)\}/g, (_, keys) => keys.split(',').map((k) => `[${refNo(k.trim())}]`).join(', '))
    .replace(/\{fig:([^}]+)\}/g, (_, id) => { if (!labels.fig[id]) throw new Error(`fig ${id}`); return `Fig. ${labels.fig[id]}`; })
    .replace(/\{tab:([^}]+)\}/g, (_, id) => { if (!labels.tab[id]) throw new Error(`tab ${id}`); return `Table ${labels.tab[id]}`; })
    .replace(/\{eq:([^}]+)\}/g, (_, id) => { if (!labels.eq[id]) throw new Error(`eq ${id}`); return `Eq. (${labels.eq[id]})`; });
}

// ------------------------------------------------------------------ inline markup: **bold**, *italic*, _{sub}, ^{sup}
function runs(text, base = {}) {
  const s = resolve(String(text));
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_\{[^}]+\}|\^\{[^}]+\})/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(new TextRun({ text: s.slice(last, m.index), font: FONTS, ...base }));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONTS, ...base }));
    else if (tok.startsWith('*')) out.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONTS, ...base }));
    else if (tok.startsWith('_')) out.push(new TextRun({ text: tok.slice(2, -1), subScript: true, font: FONTS, ...base }));
    else out.push(new TextRun({ text: tok.slice(2, -1), superScript: true, font: FONTS, ...base }));
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(new TextRun({ text: s.slice(last), font: FONTS, ...base }));
  return out;
}

const P = (text, o = {}) => new Paragraph({
  children: runs(text, { size: (o.size || 12) * 2, bold: o.bold, italics: o.italics, color: o.color }),
  alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { lineRule: LineRuleType.AUTO, line: o.line || LINE_15, before: o.before ?? 0, after: o.after ?? 80 },
  indent: o.indent,
  keepNext: o.keepNext,
  pageBreakBefore: o.pageBreakBefore,
  tabStops: o.tabStops,
});

const blank = (n = 1, size = 12) => Array.from({ length: n }, () => new Paragraph({ children: [new TextRun({ text: '', font: FONTS, size: size * 2 })], spacing: { lineRule: LineRuleType.AUTO, after: 0 } }));

function image(file, widthIn, maxHIn = 8.2) {
  const buf = fs.readFileSync(path.join(FIG, file));
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  let wi = widthIn;
  let hi = (widthIn * h) / w;
  if (hi > maxHIn) { hi = maxHIn; wi = (hi * w) / h; }
  return new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(wi * 96), height: Math.round(hi * 96) } });
}

// ------------------------------------------------------------------ tables
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const ALL = { top: thin, bottom: thin, left: thin, right: thin };
const NONE = { top: none, bottom: none, left: none, right: none };

function cell(content, width, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((t) => new Paragraph({
    children: runs(t, { size: (o.size || 12) * 2, bold: o.bold, italics: o.italics, color: o.color }),
    alignment: o.align || AlignmentType.LEFT,
    spacing: { lineRule: LineRuleType.AUTO, line: o.line || 240, after: 0, before: 0 },
  }));
  return new TableCell({
    children: paras,
    width: { size: width, type: WidthType.DXA },
    borders: o.borders || ALL,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    verticalAlign: o.valign || VerticalAlign.CENTER,
    columnSpan: o.span,
  });
}

function dataTable(headers, rows, widthsRel, o = {}) {
  const total = o.width || TEXT_W;
  const sum = widthsRel.reduce((a, b) => a + b, 0);
  const widths = widthsRel.map((w) => Math.floor((w * total) / sum));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  const size = o.size || 11;
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, widths[i], { bold: true, align: AlignmentType.CENTER, size, fill: 'D9E2DC' })),
  });
  const body = rows.map((r) => new TableRow({
    cantSplit: true,
    children: r.map((c, i) => cell(c, widths[i], { size, align: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.RIGHT][(o.align && o.align[i]) || 0] })),
  }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body], layout: TableLayoutType.FIXED });
}

// ------------------------------------------------------------------ block renderer
let listInstance = 0;
function render(b) {
  if (b.h2) return [P(b.h2, { size: 14, bold: true, align: AlignmentType.LEFT, before: 240, after: 120, keepNext: true, line: 300 })];
  if (b.h3) return [P(b.h3, { size: 12, bold: true, align: AlignmentType.LEFT, before: 180, after: 80, keepNext: true, line: 300 })];
  if (b.p) return [P(b.p)];
  if (b.bullets || b.numbered) {
    listInstance += 1;
    const ref = b.bullets ? 'bullets' : 'numbers';
    return (b.bullets || b.numbered).map((t) => new Paragraph({
      children: runs(t, { size: 24 }),
      numbering: { reference: ref, level: 0, instance: listInstance },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 60 },
    }));
  }
  if (b.fig) {
    return [
      new Paragraph({ children: [image(b.fig, ...figSize(b))], alignment: AlignmentType.CENTER, spacing: { lineRule: LineRuleType.AUTO, before: 120, after: 60 }, keepNext: true }),
      P(`**Fig. ${b._no}:** ${b.caption}`, { align: AlignmentType.CENTER, after: 200, line: 276 }),
    ];
  }
  if (b.table) {
    return [
      P(`**Table ${b._no}:** ${b.caption}`, { align: AlignmentType.CENTER, before: 120, after: 80, keepNext: true, line: 276 }),
      dataTable(b.table.headers, b.table.rows, b.table.widths, { size: b.table.size, align: b.table.align }),
      new Paragraph({ children: [], spacing: { lineRule: LineRuleType.AUTO, after: 160 } }),
    ];
  }
  if (b.eq) {
    return [new Paragraph({
      children: [new TextRun({ text: '\t', font: FONTS }), ...runs(b.eq, { size: 24, italics: false }), new TextRun({ text: `\t(${b._no})`, font: FONTS, size: 24 })],
      tabStops: [{ type: TabStopType.CENTER, position: Math.round(TEXT_W / 2) }, { type: TabStopType.RIGHT, position: TEXT_W }],
      spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, before: 60, after: 120 },
    })];
  }
  if (b.code) {
    return b.code.map((line, i) => new Paragraph({
      children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18 })],
      spacing: { lineRule: LineRuleType.AUTO, line: 240, after: 0, before: i === 0 ? 120 : 0 },
      shading: { fill: 'F2F4F3', type: ShadingType.CLEAR, color: 'auto' },
      indent: { left: 200, right: 200 },
      keepLines: true,
    })).concat([P(b.caption ? `*${b.caption}*` : '', { align: AlignmentType.CENTER, after: 160, line: 276 })]);
  }
  if (b.algo) {
    listInstance += 1;
    const out = [P(`**${b.algo}**`, { align: AlignmentType.LEFT, keepNext: true, before: 120, after: 60 })];
    b.steps.forEach((t) => out.push(new Paragraph({
      children: runs(t, { size: 24 }),
      numbering: { reference: 'steps', level: 0, instance: listInstance },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 40 },
    })));
    return out;
  }
  if (b.pagebreak) return [new Paragraph({ children: [new PageBreak()] })];
  throw new Error(`Unknown block ${JSON.stringify(b).slice(0, 80)}`);
}

function chapter(ch) {
  const out = [
    new Paragraph({ children: [new TextRun({ text: `CHAPTER ${ch.n}`, bold: true, font: FONTS, size: 32 })], alignment: AlignmentType.CENTER, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 120, line: 300 } }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: ch.title, bold: true, font: FONTS, size: 32 })], alignment: AlignmentType.CENTER, spacing: { lineRule: LineRuleType.AUTO, after: 360, line: 300 } }),
  ];
  ch.blocks.forEach((b) => out.push(...render(b)));
  return out;
}

// ------------------------------------------------------------------ front matter
const T = META.title;
const names = META.students;
const center = AlignmentType.CENTER;

function titlePage(withRoll, fulfil) {
  const kids = [
    new Paragraph({ children: [image('logo_mu.png', 1.24)], alignment: center, spacing: { lineRule: LineRuleType.AUTO, after: 240 } }),
    P(T, { size: 23, bold: true, align: center, after: 240, line: 276 }),
    new Paragraph({ alignment: center, spacing: { lineRule: LineRuleType.AUTO, after: 60 }, children: [
      new TextRun({ text: 'LY ', bold: true, font: FONTS, size: 24 }),
      new TextRun({ text: 'Innovation-Based Major Project', bold: true, font: FONTS, size: 24, color: BLUE }),
      new TextRun({ text: '-B Report', bold: true, font: FONTS, size: 24 })] }),
    P(`Submitted in partial ${fulfil} of the requirements of the Degree of`, { size: 12, bold: true, align: center, after: 60, line: 276 }),
    P('Bachelor of Technology in Computer Engineering', { size: 12, bold: true, align: center, after: 60, line: 276 }),
    P('by', { size: 12, align: center, after: 120, line: 276 }),
    ...names.map((s) => P(withRoll ? `${s.name} (${s.roll})` : s.name, { size: 15, bold: true, align: center, after: 100, line: 276 })),
    ...blank(1),
    P('Supervisor', { size: 12, bold: true, align: center, after: 100, line: 276 }),
    P(META.guide, { size: 15, bold: true, align: center, after: 280, line: 276 }),
    new Paragraph({ children: [image('logo_somaiya.png', 1.02)], alignment: center, spacing: { lineRule: LineRuleType.AUTO, after: 200 } }),
    P('Department of Computer Engineering', { size: 14, align: center, after: 60, line: 276 }),
    P('K. J. Somaiya Institute of Technology', { size: 14, align: center, after: 40, line: 276 }),
    P('An Autonomous Institute permanently affiliated to University of Mumbai', { size: 12, bold: true, align: center, after: 0, line: 240 }),
    P('Ayurvihar, Sion, Mumbai -400022', { size: 12, bold: true, align: center, after: 0, line: 240 }),
    new Paragraph({ alignment: center, children: [new TextRun({ text: META.year, bold: true, font: FONTS, size: 24, color: withRoll ? undefined : BLUE })] }),
  ];
  return kids;
}

function sigCell(lines, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders: NONE,
    children: lines.map(([t, o]) => P(t, { align: center, bold: o.bold, size: o.size || 12, italics: o.italics, after: 0, line: 240 })),
  });
}

function frontHeading(text, size = 24, after = 360) {
  return new Paragraph({ children: [new TextRun({ text, bold: true, font: FONTS, size: size * 2 })], alignment: center, spacing: { lineRule: LineRuleType.AUTO, after, line: 276 } });
}

function certificatePage() {
  const w = [1600, TEXT_W - 3200, 1600];
  const head = new Table({
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED,
    borders: { ...NONE, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders: NONE, children: [new Paragraph({ children: [image('logo_somaiya_cert.png', 1.0)], alignment: AlignmentType.LEFT })] }),
      new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders: NONE, verticalAlign: VerticalAlign.CENTER, children: [frontHeading('CERTIFICATE', 24, 0)] }),
      new TableCell({ width: { size: w[2], type: WidthType.DXA }, borders: NONE, children: [new Paragraph({ children: [image('logo_mu_cert.png', 0.97)], alignment: AlignmentType.RIGHT })] }),
    ] })],
  });
  const nameList = names.map((s) => s.name).join(', ');
  const half = Math.floor(TEXT_W * 0.58);
  return [
    head,
    ...blank(1),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 240 }, children: [
      new TextRun({ text: 'This is to certify that the project entitled “', italics: true, font: FONTS, size: 28 }),
      new TextRun({ text: T, italics: true, bold: true, font: FONTS, size: 28 }),
      new TextRun({ text: '” is bonafide work of ', italics: true, font: FONTS, size: 28 }),
      new TextRun({ text: nameList, italics: true, bold: true, font: FONTS, size: 28 }),
      new TextRun({ text: ' submitted to the University of Mumbai in partial fulfillment of the requirement in Major Project, for the award of the degree of “Bachelors of Technology” in “Computer Engineering”.', italics: true, font: FONTS, size: 28 })] }),
    ...blank(2),
    P('_____________________________________', { align: center, bold: true, after: 0, line: 240 }),
    P(META.guide, { align: center, bold: true, after: 0, line: 240 }),
    P('Project Guide', { align: center, bold: true, size: 11, after: 0, line: 240 }),
    P('Department of Computer Engineering', { align: center, bold: true, after: 0, line: 240 }),
    ...blank(3),
    new Table({
      width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [half, TEXT_W - half], layout: TableLayoutType.FIXED,
      rows: [new TableRow({ children: [
        sigCell([['_______________________________________', { size: 10, italics: true }], ['Dr. Sarita Ambadekar,', { bold: true }], ['Head, Department of Computer Engineering', { bold: true }]], half),
        sigCell([['____________________________________', { size: 10, italics: true }], ['Dr. Vivek Sunnapwar', { bold: true }], ['Principal KJSIT', { bold: true }]], TEXT_W - half),
      ] })],
    }),
    ...blank(5),
    P('Place: Sion, Mumbai-400022', { align: AlignmentType.LEFT, after: 0, line: 276 }),
    P('Date:', { align: AlignmentType.LEFT, after: 0, line: 276 }),
  ];
}

function approvalPage() {
  const sig = (n, who) => [
    P(`${n}. _______________________`, { align: AlignmentType.LEFT, indent: { left: 5200 }, after: 0, line: 276 }),
    P('Name and Signature', { align: AlignmentType.LEFT, indent: { left: 5450 }, after: 0, line: 276 }),
    P(who, { align: AlignmentType.LEFT, indent: { left: 5450 }, bold: true, after: 0, line: 276 }),
  ];
  return [
    new Paragraph({ children: [new TextRun({ text: 'PROJECT APPROVAL FOR L. Y.', bold: true, font: FONTS, size: 36 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 480 } }),
    new Paragraph({ spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 120 }, alignment: AlignmentType.LEFT, children: [
      new TextRun({ text: 'This project report entitled “', font: FONTS, size: 24 }),
      new TextRun({ text: T, bold: true, font: FONTS, size: 24 }),
      new TextRun({ text: '” by', font: FONTS, size: 24 })] }),
    ...names.map((s) => P(`${s.name} (${s.roll})`, { align: center, after: 120 })),
    new Paragraph({ spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 360 }, alignment: AlignmentType.LEFT, children: [
      new TextRun({ text: 'is an approved Last Year ', font: FONTS, size: 24 }),
      new TextRun({ text: 'Innovation-Based Major Project', font: FONTS, size: 24, color: BLUE }),
      new TextRun({ text: ' in Computer Engineering', bold: true, font: FONTS, size: 24 }),
      new TextRun({ text: '.', font: FONTS, size: 24 })] }),
    P('Examiners:', { align: center, bold: true, after: 360 }),
    ...sig(1, 'External Examiner'),
    ...blank(3),
    ...sig(2, 'Internal Examiner'),
    ...blank(9),
    P('Place: Sion, Mumbai-400022', { align: AlignmentType.LEFT, after: 0, line: 276 }),
    P('Date:', { align: AlignmentType.LEFT, after: 0, line: 276 }),
  ];
}

function declarationPage() {
  return [
    new Paragraph({ children: [new TextRun({ text: 'DECLARATION', bold: true, font: FONTS, size: 36 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 480 } }),
    P('We declare that this written submission represents our ideas in our own words and where other\'s ideas or words have been included, we have adequately cited and referenced the sources. We also declare that we have adhered to all principles of academic honesty and integrity and have not misrepresented or fabricated or falsified any idea/data/fact/source in our submission. We understand that any violation of the above will be cause for disciplinary action by the Institute and can also evoke penal action from the sources which have thus not been properly cited or from whom proper permission has not been taken when needed.'),
    ...blank(2),
    ...names.flatMap((s) => [P(s.name, { align: AlignmentType.RIGHT, after: 0 }), ...blank(1)]),
    ...blank(8),
    P('Date:', { align: AlignmentType.LEFT }),
  ];
}

function acknowledgementPage() {
  const para = (parts) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 240 },
    children: parts.map(([t, b]) => new TextRun({ text: t, bold: !!b, font: FONTS, size: 24 })) });
  return [
    new Paragraph({ children: [new TextRun({ text: 'ACKNOWLEDGEMENT', bold: true, font: FONTS, size: 36 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 480 } }),
    para([['Before presenting our LY Major Project work entitled “'], [T, true], ['”, we would like to convey our sincere thanks to the people who guided us throughout the course for this project work.']]),
    para([['First, We would like to express our immense gratitude towards our '], ['Project Guide ' + META.guide, true], [' for the constant encouragement, support, guidance, and mentoring at the ongoing stages of the project and report.']]),
    para([['We would like to express our sincere thanks to our '], ['H.O.D. Dr. Sarita Ambadekar', true], [', for the encouragement, co-operation, and suggestions progressing stages of the report.']]),
    para([['We would like to express our sincere thanks to our beloved '], ['Principal Dr. Vivek Sunnapwar', true], [' for providing various facilities to carry out this project.']]),
    para([['Finally, we would like to thank all the teaching and non-teaching staff of the college, and our friends, for their moral support rendered during the course of the reported work, and for their direct and indirect involvement in the completion of our report work, which made our endeavor fruitful.']]),
    ...blank(6),
    P('Place: Sion, Mumbai-400022', { align: AlignmentType.LEFT, after: 0, line: 276 }),
    P('Date:', { align: AlignmentType.LEFT, after: 0, line: 276 }),
  ];
}

function abstractPage() {
  return [
    new Paragraph({ children: [new TextRun({ text: 'ABSTRACT', bold: true, font: FONTS, size: 36 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 360 } }),
    ...META.abstract.map((t) => P(t, { after: 200 })),
    P(`**Keywords:** ${META.keywords}`, { before: 120 }),
  ];
}

const pg = (key) => (PAGES[key] !== undefined ? String(PAGES[key]) : '');

function contentsPage() {
  const w = [700, 700, TEXT_W - 2600, 1200];
  const row = (a, b, title, page, bold) => new TableRow({ cantSplit: true, children: [
    cell(a, w[0], { size: 12 }), cell(b, w[1], { size: 12 }), cell(title, w[2], { size: 12, bold }), cell(page, w[3], { size: 12, align: center }),
  ] });
  const rows = [
    new TableRow({ tableHeader: true, children: [cell('Chapter No.', w[0] + w[1], { bold: true, span: 2 }), cell('TITLE', w[2], { bold: true }), cell('Page No.', w[3], { bold: true, align: center })] }),
    row('', '', 'LIST OF FIGURES', pg('LIST OF FIGURES'), true),
    row('', '', 'LIST OF TABLES', pg('LIST OF TABLES'), true),
    row('', '', 'LIST OF ABBREVIATION', pg('LIST OF ABBREVIATIONS'), true),
    row('', '', '', ''),
  ];
  CHAPTERS.forEach((ch) => {
    rows.push(row(String(ch.n), '', ch.title, pg(ch.title), true));
    ch.blocks.filter((b) => b.h2).forEach((b) => {
      const m = b.h2.match(/^(\d+\.\d+)\s+(.*)$/);
      rows.push(row('', m[1], m[2], pg(b.h2)));
    });
    rows.push(row('', '', '', ''));
  });
  ['REFERENCES', 'PUBLISHED PAPERS', 'CERTIFICATES', 'PLAGIARISM REPORT'].forEach((t) => rows.push(row('', '', t, pg(t), true)));
  return [
    new Paragraph({ children: [new TextRun({ text: 'CONTENTS', bold: true, font: FONTS, size: 36 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 240 } }),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, rows, layout: TableLayoutType.FIXED }),
  ];
}

function listPage(title, headerNo, items) {
  const w = [1100, TEXT_W - 2300, 1200];
  const rows = [new TableRow({ tableHeader: true, children: [cell(headerNo, w[0], { bold: true, align: center }), cell('Title', w[1], { bold: true, align: center }), cell('Page No.', w[2], { bold: true, align: center })] })];
  items.forEach((it) => rows.push(new TableRow({ cantSplit: true, children: [
    cell(it.no, w[0], { align: center }), cell(it.title, w[1]), cell(pg(`${headerNo === 'Figure No.' ? 'Fig.' : 'Table'} ${it.no}:`), w[2], { align: center }),
  ] })));
  return [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, font: FONTS, size: 28 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 240 } }),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, rows, layout: TableLayoutType.FIXED }),
  ];
}

function abbreviationsPage() {
  const w = [900, 2000, TEXT_W - 2900];
  const rows = [new TableRow({ tableHeader: true, children: [cell('Sr. No', w[0], { bold: true, align: center }), cell('Abbreviation', w[1], { bold: true, align: center }), cell('Description', w[2], { bold: true, align: center })] })];
  META.abbreviations.forEach(([a, d], i) => rows.push(new TableRow({ cantSplit: true, children: [cell(String(i + 1), w[0], { align: center }), cell(a, w[1], { align: center }), cell(d, w[2])] })));
  return [
    new Paragraph({ children: [new TextRun({ text: 'LIST OF ABBREVIATIONS', bold: true, font: FONTS, size: 28 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 240 } }),
    new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, rows, layout: TableLayoutType.FIXED }),
  ];
}

// ------------------------------------------------------------------ back matter
function endHeading(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, font: FONTS, size: 32 })], alignment: center, pageBreakBefore: true, spacing: { lineRule: LineRuleType.AUTO, after: 360 } });
}

function referencesSection() {
  return [
    endHeading('REFERENCES'),
    ...citeOrder.map((k, i) => new Paragraph({
      children: [new TextRun({ text: `[${i + 1}]\t`, font: FONTS, size: 24 }), ...runs(REFS[k].ieee, { size: 24 })],
      tabStops: [{ type: TabStopType.LEFT, position: 600 }],
      indent: { left: 600, hanging: 600 },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { lineRule: LineRuleType.AUTO, line: LINE_15, after: 100 },
    })),
  ];
}

function placeholderSection(title, lines) {
  return [endHeading(title), ...lines.map((t) => P(t, { align: AlignmentType.CENTER, italics: true }))];
}

// ------------------------------------------------------------------ literature table (needs citation numbers)
function literatureRows() {
  return citeOrder.filter((k) => REFS[k].lit).map((k) => {
    const r = REFS[k];
    return [`[${refNo(k)}]`, r.lit.who, r.lit.approach, r.lit.finding, r.lit.gap];
  });
}

// ------------------------------------------------------------------ assemble
preScan();
// Inject the literature table rows now that citation numbers are known
CHAPTERS[1].blocks.forEach((b) => { if (b.table && b.table.fromReferences) b.table.rows = literatureRows(); });

const footer = new Footer({ children: [new Paragraph({ alignment: center, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONTS, size: 24 })] })] });
const pageProps = (fmt, start) => ({
  page: { size: { width: PAGE_W, height: PAGE_H }, margin: MARGIN, pageNumbers: fmt ? { start, formatType: fmt } : undefined },
});

const doc = new Document({
  creator: META.students.map((s) => s.name).join(', '),
  title: T,
  description: 'LY Innovation-Based Major Project-B Report',
  styles: {
    default: { document: { run: { font: FONTS, size: 24 }, paragraph: { spacing: { lineRule: LineRuleType.AUTO, line: LINE_15 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONTS, size: 32, bold: true, color: '000000' }, paragraph: { outlineLevel: 0, alignment: AlignmentType.CENTER } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: 'Step %1:', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1100, hanging: 900 } } } }] },
    ],
  },
  sections: [
    { properties: pageProps(), children: titlePage(false, 'fulfillment') },
    { properties: pageProps(), children: titlePage(true, 'fulfilment') },
    {
      properties: pageProps(NumberFormat.LOWER_ROMAN, 1),
      footers: { default: footer },
      children: [
        ...certificatePage(), ...approvalPage(), ...declarationPage(), ...acknowledgementPage(), ...abstractPage(),
        ...contentsPage(), ...listPage('LIST OF FIGURES', 'Figure No.', figList), ...listPage('LIST OF TABLES', 'Table No.', tabList),
        ...abbreviationsPage(),
      ],
    },
    {
      properties: pageProps(NumberFormat.DECIMAL, 1),
      footers: { default: footer },
      children: [
        ...CHAPTERS.flatMap(chapter),
        ...referencesSection(),
        ...placeholderSection('PUBLISHED PAPERS', META.placeholders.papers),
        ...placeholderSection('CERTIFICATES', META.placeholders.certificates),
        ...placeholderSection('PLAGIARISM REPORT', META.placeholders.plagiarism),
      ],
    },
  ],
});

// Heading texts used by extract_pages.py to locate page numbers
const index = {
  chapters: CHAPTERS.map((c) => ({ title: c.title, subs: c.blocks.filter((b) => b.h2).map((b) => b.h2) })),
  figures: figList.map((f) => `Fig. ${f.no}:`),
  tables: tabList.map((t) => `Table ${t.no}:`),
};
fs.writeFileSync(path.join(__dirname, 'index.json'), JSON.stringify(index, null, 1));

const out = path.join(__dirname, 'SMA_Major_Project_Report.docx');
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log('written', out, `figures=${figList.length} tables=${tabList.length} refs=${citeOrder.length}`);
});

# Major Project-B Report (KJSIT format)

`SMA_Major_Project_Report.docx` is the project report written in the format of
*Major Project B Report Format SEM VII 26-27.pdf* (repository root):

- Times New Roman · headings 16 pt, sub-headings 14 pt, text 12 pt · line spacing 1.5 · justified
- A4, margins left 1.5", others 1"
- Front matter: cover, inner title page, Certificate (i), Project Approval (ii), Declaration (iii),
  Acknowledgement (iv), Abstract (v), Contents, List of Figures, List of Tables, List of Abbreviations
- Chapters 1–8 (Introduction → Conclusion & Future Scope), References, Published Papers,
  Certificates, Plagiarism Report
- 78 pages in total; 58 pages from Introduction to Conclusion (minimum 50, maximum 70–80 overall)

`SMA_Major_Project_Report.pdf` is a preview rendered with LibreOffice. Open the `.docx` in
Microsoft Word for the final version.

## Before submission — fill in

- Roll numbers (cover page 2, Project Approval page)
- Confirm the guide's name (set to *Dr. Shyamal Virnodkar*, the use-case PI) in `content/meta.js`
- Signatures and dates on the Certificate, Approval, Declaration and Acknowledgement pages
- Replace the bracketed notes under PUBLISHED PAPERS / CERTIFICATES / PLAGIARISM REPORT with the actual pages

## Rebuilding

```bash
cd report
npm install                 # docx (document generator)
python3 make_figures.py     # charts and screenshot crops -> figures/   (needs matplotlib, pandas)
python3 extra_analysis.py   # per-taluk, learning-curve and uncertainty analysis (needs scikit-learn)
./render.sh                 # builds the DOCX twice, filling page numbers from a LibreOffice render
```

`render.sh` needs LibreOffice (`soffice`) and PyMuPDF. Page numbers in CONTENTS and the lists
are taken from the rendered PDF (`pages.json`); if you edit the document heavily in Word,
re-check them before printing.

| Path | Purpose |
|---|---|
| `content/ch1.js` … `ch8.js` | Chapter text, figures, tables and equations |
| `content/meta.js` | Title, students, guide, abstract, abbreviations |
| `content/references.js` | IEEE references + literature-survey table rows |
| `uml/*.puml`, `uml/*.dot` | UML (PlantUML) and DFD / block diagrams (Graphviz) |
| `build_report.js` | DOCX builder (docx-js) |
| `data/results.json`, `data/extra.json` | Numbers captured from the running system |

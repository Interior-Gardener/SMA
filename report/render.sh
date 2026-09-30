#!/bin/sh
# Builds the DOCX twice (to fill page numbers) and renders the PDF with LibreOffice.
set -e
cd "$(dirname "$0")"
SOFFICE=${SOFFICE:-soffice}
node build_report.js
$SOFFICE --headless --convert-to pdf SMA_Major_Project_Report.docx >/dev/null 2>&1
python3 extract_pages.py SMA_Major_Project_Report.pdf
node build_report.js
$SOFFICE --headless --convert-to pdf SMA_Major_Project_Report.docx >/dev/null 2>&1
python3 extract_pages.py SMA_Major_Project_Report.pdf

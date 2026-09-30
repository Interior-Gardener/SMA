"""
Reads the rendered PDF and records the printed page number of every chapter,
section, figure and table (plus front-matter lists) into pages.json, which
build_report.js uses to fill CONTENTS / LIST OF FIGURES / LIST OF TABLES.

    python3 extract_pages.py SMA_Major_Project_Report.pdf
"""
import json
import os
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
pdf = pymupdf.open(sys.argv[1])
index = json.load(open(os.path.join(HERE, "index.json")))

def roman(n):
    vals = [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out

pages = [[l.strip() for l in p.get_text().split("\n") if l.strip()] for p in pdf]
# front matter starts at CERTIFICATE (page i); body starts at "CHAPTER 1" (page 1)
cert = next(i for i, ls in enumerate(pages) if "CERTIFICATE" in ls)
body = next(i for i, ls in enumerate(pages) if "CHAPTER 1" in ls)
label = lambda i: roman(i - cert + 1) if i < body else str(i - body + 1)

out = {}
for i in range(cert, body):
    for key, title in [("LIST OF FIGURES", "LIST OF FIGURES"), ("LIST OF TABLES", "LIST OF TABLES"), ("LIST OF ABBREVIATIONS", "LIST OF ABBREVIATIONS")]:
        if pages[i] and pages[i][0] == title and key not in out:
            out[key] = label(i)

def find(text, start=body, prefix=False):
    for i in range(start, len(pages)):
        for l in pages[i]:
            if (l.startswith(text) if prefix else l == text):
                return i
    return None

missing = []
for ch in index["chapters"]:
    i = find(ch["title"])
    if i is None:
        missing.append(ch["title"])
    else:
        out[ch["title"]] = label(i)
    for s in ch["subs"]:
        j = find(s)
        if j is None:
            missing.append(s)
        else:
            out[s] = label(j)
for key in index["figures"] + index["tables"]:
    j = find(key, prefix=True)
    if j is None:
        missing.append(key)
    else:
        out[key] = label(j)
for t in ["REFERENCES", "PUBLISHED PAPERS", "CERTIFICATES", "PLAGIARISM REPORT"]:
    j = find(t)
    if j is not None:
        out[t] = label(j)

json.dump(out, open(os.path.join(HERE, "pages.json"), "w"), indent=1)
last_ch = find("REFERENCES")
print(f"pages total={len(pages)} front={body - cert} body(Intro..Conclusion)={last_ch - body} missing={missing}")

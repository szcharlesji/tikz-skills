#!/usr/bin/env python3
"""Compile a standalone TikZ figure to PDF and PNG, and report errors tersely.

    python render.py path/to/figure.tex [--dpi 220] [--engine pdflatex]

- Copies dlviz.sty next to the .tex if it is not already there, so the output
  folder is self-contained and the user can recompile it.
- On failure, prints only the first LaTeX error with a few lines of context
  (the full log stays in figure.log) and suggests `tlmgr install` for missing
  packages.
- On success, writes figure.pdf and figure.png and removes aux files.
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
STY = SKILL_DIR / "assets" / "dlviz.sty"

# package file -> TeX Live package name, for the common misses on BasicTeX
TLMGR_NAMES = {"standalone.cls": "standalone", "pgfplots.sty": "pgfplots",
               "preview.sty": "preview", "tikz.sty": "pgf"}


def first_error(log: str) -> str:
    lines = log.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("!") or re.match(r"^\S+\.tex:\d+: ", line):
            ctx = []
            for l in lines[i: i + 10]:
                if l.startswith("Here is how much"):
                    break
                ctx.append(l)
            return "\n".join(ctx).rstrip()
    return "\n".join(lines[-25:])


def missing_package(log: str):
    m = re.search(r"File `([^']+\.(?:sty|cls))' not found", log)
    return m.group(1) if m else None


def to_png(pdf: Path, png: Path, dpi: int) -> bool:
    if shutil.which("pdftoppm"):
        cmd = ["pdftoppm", "-png", "-r", str(dpi), "-singlefile", str(pdf),
               str(png.with_suffix(""))]
    elif shutil.which("gs"):
        cmd = ["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=png16m",
               f"-r{dpi}", "-dTextAlphaBits=4", "-dGraphicsAlphaBits=4",
               "-dFirstPage=1", "-dLastPage=1", f"-sOutputFile={png}", str(pdf)]
    elif shutil.which("magick"):
        cmd = ["magick", "-density", str(dpi), f"{pdf}[0]", str(png)]
    elif shutil.which("sips"):
        cmd = ["sips", "-s", "format", "png", str(pdf), "--out", str(png)]
    else:
        return False
    return subprocess.run(cmd, capture_output=True).returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tex", type=Path)
    ap.add_argument("--dpi", type=int, default=220)
    ap.add_argument("--engine", default="pdflatex",
                    help="pdflatex (default), lualatex or xelatex")
    args = ap.parse_args()

    tex = args.tex.resolve()
    if not tex.exists():
        sys.exit(f"no such file: {tex}")
    work = tex.parent
    # keep a copy of the style next to the figure; refresh it when the skill's
    # version is newer (a user who edits their local copy makes it newer)
    local = work / "dlviz.sty"
    if "dlviz" in tex.read_text() and (
            not local.exists() or local.stat().st_mtime < STY.stat().st_mtime):
        shutil.copy(STY, local)

    if not shutil.which(args.engine):
        sys.exit(f"{args.engine} not found; install a TeX distribution "
                 "(e.g. MacTeX/BasicTeX or TeX Live).")

    proc = subprocess.run(
        [args.engine, "-interaction=nonstopmode", "-halt-on-error",
         "-file-line-error", tex.name],
        cwd=work, capture_output=True, text=True, errors="replace")
    log_path = tex.with_suffix(".log")
    log = log_path.read_text(errors="replace") if log_path.exists() else proc.stdout

    if proc.returncode != 0:
        print("COMPILE FAILED\n")
        print(first_error(log))
        pkg = missing_package(log)
        if pkg:
            name = TLMGR_NAMES.get(pkg, Path(pkg).stem)
            print(f"\nMissing {pkg}. Install it with:\n"
                  f"  tlmgr install {name}\n"
                  f"or, without admin rights:\n"
                  f"  tlmgr init-usertree && tlmgr --usermode install {name}")
        print(f"\nfull log: {log_path}")
        sys.exit(1)

    pdf = tex.with_suffix(".pdf")
    png = tex.with_suffix(".png")
    ok = to_png(pdf, png, args.dpi)

    warnings = [l for l in log.splitlines()
                if re.search(r"(Package (pgf|tikz|pgfplots) Warning|"
                             r"Missing character|Undefined control)", l)]
    for ext in (".aux", ".log"):
        p = tex.with_suffix(ext)
        if p.exists() and not warnings:
            p.unlink()

    print(f"pdf: {pdf}")
    print(f"png: {png}" if ok else "png: (no converter found: install poppler "
          "or ghostscript; the PDF is fine)")
    if warnings:
        print("\nwarnings worth a look:")
        for w in warnings[:10]:
            print("  " + w)


if __name__ == "__main__":
    main()

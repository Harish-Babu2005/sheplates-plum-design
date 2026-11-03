#!/usr/bin/env python3
"""Move ShePlates from the single-plum recolour to the approved brand roles (colour only, no behaviour).

  Plum        #512D3A  identity, navigation, headings, selected states, dark panels
  Terracotta  #C65D3A  primary actions (buttons) and purchase controls
  Gold        #D9B879  selective highlights (on dark panels, promos)
  Ivory page  #FAF7F2, white cards, soft surfaces #F5EDE7, ink #292526

Run from the repo root:  python3 scripts/retheme-terracotta.py
The script rewrites hard-coded colours in components/, app/ and lib/ (TypeScript, TSX). Stylesheets are edited by hand
because each rule needs a role, and the central tokens live in app/theme-2.css.
"""
import glob
import re

PLUM, PLUM_HOVER = "#512D3A", "#40222E"
TERRA, TERRA_HOVER = "#C65D3A", "#A84B2C"
GOLD = "#D9B879"
INK = "#292526"
SOFT, SOFT_2 = "#F5EDE7", "#EDE2DA"
TINT, TINT_2 = "#F2E8EC", "#E6D2DA"
LINE = "#E9DDD5"
SECONDARY, MUTED, BODY = "#665B5D", "#6F6567", "#4A4143"

SIMPLE = {
    "#faf6f4": SOFT, "#f0e8e7": SOFT_2, "#f7edf0": TINT, "#653046": PLUM, "#e8dfe1": LINE,
    "#71676b": SECONDARY, "#766b70": MUTED, "#4c4246": BODY, "#efd9e0": "#EADBE1",
    "#1e1719": "#211C1D", "#1d1618": "#211C1D", "#b9afb3": "#B9AEA9",
}


def run_of(text: str, i: int):
    """The quoted run of characters around position i (a className string or one branch of a ternary)."""
    left = max(text.rfind(q, 0, i) for q in ('"', "'", "`"))
    right_candidates = [p for p in (text.find(q, i) for q in ('"', "'", "`")) if p != -1]
    right = min(right_candidates) if right_candidates else len(text)
    return left + 1, right


def is_ternary_branch(text: str, start: int) -> bool:
    before = text[max(0, start - 6):start - 1].replace(" ", "").replace("\n", "")
    return before.endswith("?") or before.endswith(":") or before.endswith("&&") or before.endswith("(")


def enclosing_tag(text: str, i: int) -> str:
    tags = list(re.finditer(r"<([A-Za-z][\w.]*)", text[max(0, i - 900):i]))
    return tags[-1].group(1) if tags else ""


def retheme(text: str) -> str:
    out = []
    pos = 0
    # 1) plum backgrounds: buttons become terracotta, selected pills / icon tiles / dots stay plum
    pattern = re.compile(r"bg-\[#753b50\]")
    for m in pattern.finditer(text):
        i = m.start()
        start, end = run_of(text, i)
        tag = enclosing_tag(text, i)
        ternary = is_ternary_branch(text, start)
        action = tag in ("Button", "button", "a") and not ternary
        out.append((i, m.end(), f"bg-[{TERRA if action else PLUM}]"))
        if action:
            run = text[start:end]
            for h in re.finditer(r"hover:bg-\[#(602d40|4d8b00|292124)\]", run):
                out.append((start + h.start(), start + h.end(), f"hover:bg-[{TERRA_HOVER}]"))
    text2 = text
    seen = set()
    for a, b, new in sorted(set(out), reverse=True):
        if (a, b) in seen:
            continue
        seen.add((a, b))
        text2 = text2[:a] + new + text2[b:]
    text = text2

    # 2) dark ink: panels and dark buttons become plum, text stays ink
    text = re.sub(r"bg-\[#292124\](/\d+)", rf"bg-[{INK}]\1", text)
    text = text.replace("hover:bg-[#292124]", f"hover:bg-[{PLUM_HOVER}]")
    text = text.replace("bg-[#292124]", f"bg-[{PLUM}]")
    text = re.sub(r"(from|via|to)-\[#292124\]", rf"\1-[{PLUM}]", text)
    text = re.sub(r"(background(?:Color)?\s*[:=]\s*\{?\s*\"?)#292124", rf"\1{PLUM}", text)

    # 3) light plum used as text on dark panels becomes the gold highlight; as a fill it becomes a soft plum tint
    text = text.replace("text-[#e8cbd5]", f"text-[{GOLD}]")
    text = re.sub(r"(color\s*[:=]\s*\{?\s*\"?)#e8cbd5", rf"\1{GOLD}", text)
    text = text.replace("#e8cbd5", TINT_2)

    # 4) remaining plum: selected states, borders, rings, text, charts
    text = text.replace("hover:bg-[#753b50]", f"hover:bg-[{PLUM}]")
    text = text.replace("#753b50", PLUM)
    text = text.replace("#602d40", PLUM_HOVER)
    text = text.replace("#292124", INK)
    for old, new in SIMPLE.items():
        text = text.replace(old, new)
    # rgba forms of the old plum and ink
    text = text.replace("rgba(117, 59, 80,", "rgba(81, 45, 58,").replace("rgba(117,59,80,", "rgba(81,45,58,")
    text = text.replace("rgba(41, 33, 36,", "rgba(41, 37, 38,").replace("rgba(41,33,36,", "rgba(41,37,38,")
    return text


CSS_FILES = ["app/theme-2.css", "app/design-kit.css", "app/shell-kit.css", "app/staff-kit.css", "app/globals.css"]
BG_PROPS = {"background", "background-color", "background-image"}
# value maps by property family; custom-property definitions (--x: ...) are written by hand in the token blocks
CSS_BG = {"#753b50": "var(--selected)", "#292124": "var(--brand-primary)", "#faf6f4": "var(--surface-soft)", "#f7edf0": "var(--selected-soft)",
          "#e8cbd5": "var(--selected-soft-strong)", "#602d40": "var(--brand-primary-hover)", "#382d32": "var(--brand-primary-hover)",
          "#f0e8e7": "var(--surface-soft-2)", "#efd9e0": "var(--selected-soft)"}
CSS_COLOR = {"#753b50": "var(--brand-primary)", "#653046": "var(--brand-primary)", "#292124": "var(--foreground)", "#e8cbd5": "var(--brand-accent)",
             "#71676b": "var(--text-secondary)", "#766b70": "var(--text-muted)", "#4c4246": "var(--text-body)", "#602d40": "var(--brand-primary-hover)"}
CSS_OTHER = {"#753b50": "var(--selected)", "#653046": "var(--brand-primary)", "#292124": "var(--foreground)", "#e8cbd5": "var(--selected-soft-strong)",
             "#e8dfe1": "var(--border)", "#71676b": "var(--text-secondary)", "#766b70": "var(--text-muted)", "#4c4246": "var(--text-body)",
             "#f7edf0": "var(--selected-soft)", "#faf6f4": "var(--surface-soft)", "#602d40": "var(--brand-primary-hover)", "#f0e8e7": "var(--surface-soft-2)"}


def retheme_css(text: str) -> str:
    def decl(m):
        prop, value = m.group(1), m.group(2)
        if prop.startswith("--"):
            return m.group(0)
        table = CSS_BG if prop in BG_PROPS else CSS_COLOR if prop in ("color", "fill", "stroke", "caret-color", "-webkit-text-fill-color") else CSS_OTHER
        def hexsub(h):
            key = h.group(0).lower()
            return table.get(key, CSS_OTHER.get(key, h.group(0)) if prop not in BG_PROPS else table.get(key, h.group(0)))
        value = re.sub(r"#[0-9a-fA-F]{6}\b", hexsub, value)
        value = value.replace("rgba(117, 59, 80,", "rgba(81, 45, 58,").replace("rgba(41, 33, 36,", "rgba(41, 37, 38,")
        return f"{prop}{m.group(3)}{value}"
    return re.sub(r"([\w-]+)(\s*:\s*)([^;{}]*)", lambda m: decl(type("M", (), {"group": lambda self, n, m=m: {0: m.group(0), 1: m.group(1), 2: m.group(3), 3: m.group(2)}[n]})()), text)


def main():
    files = [f for pattern in ("components/**/*.tsx", "components/**/*.ts", "app/**/*.tsx", "app/**/*.ts", "lib/**/*.ts")
             for f in glob.glob(pattern, recursive=True)]
    changed = 0
    for f in sorted(set(files)):
        original = open(f, encoding="utf-8").read()
        updated = retheme(original)
        if updated != original:
            open(f, "w", encoding="utf-8").write(updated)
            changed += 1
    for f in CSS_FILES:
        original = open(f, encoding="utf-8").read()
        updated = retheme_css(original)
        if updated != original:
            open(f, "w", encoding="utf-8").write(updated)
            changed += 1
    print(f"rewrote {changed} files")


if __name__ == "__main__":
    main()

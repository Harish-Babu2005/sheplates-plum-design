#!/usr/bin/env python3
"""Move ShePlates to the launch palette (colour only, no behaviour).

  Peacock teal  #0C7478  primary: buttons, navigation, selected states, links, focus ring, dark panels
  White         #FFFFFF  secondary: cards and secondary buttons
  Near black    #0F1B1D  headings, text and icons
  Fresh green   #3DBE74  accent fill (always with near-black text, never white text, never as text)
  Mint          #D9F5E7  accent tint and highlight text on teal
  Greys         page #F6F8F8, soft #EEF2F2, border #DDE3E4, secondary text #55656A, muted #5F6F74

Run from the repo root:  python3 scripts/retheme-teal.py
Rewrites hard-coded colours in components/, app/ and lib/ (TS and TSX). The central tokens in app/theme-2.css and the
stylesheets reference them by name, so they are edited by hand where a rule needs a different role.
"""
import glob
import re

TEAL, TEAL_HOVER = "#0C7478", "#095A5D"
GREEN, MINT = "#3DBE74", "#D9F5E7"

# Retired plum / terracotta / gold / ivory values -> launch palette.
MAP = {
    "#512D3A": TEAL, "#40222E": TEAL_HOVER, "#C65D3A": TEAL, "#A84B2C": TEAL_HOVER,
    "#FAF7F2": "#F6F8F8", "#F5EDE7": "#EEF2F2", "#EDE2DA": "#E3E9E9", "#E9DDD5": "#DDE3E4",
    "#F2E8EC": "#E4F2F2", "#E6D2DA": "#C5E3E4", "#EADBE1": "#D3E8E9", "#F8E7DF": "#E4F2F2",
    "#292526": "#0F1B1D", "#4A4143": "#2F3C3F", "#665B5D": "#55656A", "#6F6567": "#5F6F74",
    "#B9AEA9": "#B6C0C2", "#211C1D": "#0F1B1D",
}


def retheme(text: str) -> str:
    # Gold was the highlight: as text on a dark panel it becomes mint, as a fill it becomes fresh green.
    text = text.replace("text-[#D9B879]", f"text-[{MINT}]")
    text = re.sub(r"(color\s*[:=]\s*\{?\s*\"?)#D9B879", rf"\1{MINT}", text, flags=re.I)
    text = text.replace("#D9B879", GREEN)
    for old, new in MAP.items():
        text = text.replace(old, new)
        text = text.replace(old.lower(), new)
    text = text.replace("rgba(81, 45, 58,", "rgba(12, 116, 120,").replace("rgba(81,45,58,", "rgba(12,116,120,")
    text = text.replace("rgba(41, 37, 38,", "rgba(15, 27, 29,").replace("rgba(41,37,38,", "rgba(15,27,29,")
    return text


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
    print(f"rewrote {changed} files")


if __name__ == "__main__":
    main()

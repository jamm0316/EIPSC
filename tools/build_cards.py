#!/usr/bin/env python3
"""카드 앱(artifact db) export → data/cards.json

사용: python3 tools/build_cards.py <db-export-dir>
  <db-export-dir> : ArtifactData list(out_dir=...)로 받은 cards/*.json 폴더
retired 카드는 빼고, 학습에 필요한 필드만 남긴다.
"""
import json, sys, pathlib

KEEP = ["area", "kind", "type", "unit", "title", "path", "loc", "front", "code",
        "lang", "back", "note", "src", "concept", "examples", "ok", "ng", "box"]

def main(src):
    out = []
    for f in sorted(pathlib.Path(src).glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("retired"):
            continue
        c = {"id": f.stem}
        for k in KEEP:
            v = d.get(k)
            if v not in (None, "", []):
                c[k] = v
        # 빠진 분류 보정: path 'A > B > C' → unit 'A > B', title 'C'
        segs = [s.strip() for s in str(d.get("path", "")).split(">") if s.strip()]
        if "unit" not in c and len(segs) > 1:
            c["unit"] = " > ".join(segs[:-1])
        if "title" not in c and segs:
            c["title"] = segs[-1]
        if "kind" not in c:
            c["kind"] = "코드" if d.get("code") else "개념"
        if "lang" not in c and d.get("code") and segs and segs[0] in ("Java", "C", "Python", "SQL"):
            c["lang"] = segs[0]
        out.append(c)
    dest = pathlib.Path(__file__).resolve().parent.parent / "data" / "cards.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} cards → {dest}")

if __name__ == "__main__":
    main(sys.argv[1])

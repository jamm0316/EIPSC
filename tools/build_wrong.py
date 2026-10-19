#!/usr/bin/env python3
"""오답노트 데이터 재생성: data/wrong.json + img/wrong/*.webp

python3 tools/build_wrong.py <01_정보처리기사 폴더>

- _tutor/sessions/*.md 문항별 표에서 ✕(틀림·무응답·부분답)와 △(찍어 맞힘)를 모은다.
- 회차 PDF(01_실기_기출문제/연도별_복원문제/YYYY/)를 주석 숨김으로 150dpi 렌더링하고,
  초록 번호 상자(문제 20개 + 정답 및 검증 메모 20개)를 찾아 문항별로 자른다.
- 새 회차를 풀면 SESSION_EXAM에 세션 파일 → 회차를 추가한다(표의 문항이 '2024-1#5'처럼 회차를 적으면 None).
필요: poppler(pdftoppm), Pillow, numpy
"""
import csv, glob, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

SESSION_EXAM = {'2026-10-02.md':'2025-3','2026-10-05.md':'2025-2','2026-10-05_2.md':'2025-1','2026-10-07.md':'2024-3',
                '2026-10-11.md':None,'2026-10-13.md':'2023-3','2026-10-13_2.md':'2023-2','2026-10-16.md':None}
AREA = {'SW공학':'sw','DB이론':'db','SQL':'db','네트워크':'net','보안':'sec','운영체제':'os'}
TOP, BOT, X0, X1 = 75, 1660, 95, 1150
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def collect(base):
    key = {(r['exam'], int(r['no'])): r for r in csv.DictReader(open(base+'/_tutor/answer_key.csv', encoding='utf-8-sig'))}
    rows = []
    for f, ex in SESSION_EXAM.items():
        cur = ex
        for line in open(f'{base}/_tutor/sessions/{f}', encoding='utf-8'):
            m = re.match(r'## 문항별 — (\d{4}-\d)', line)
            if m: cur = m.group(1)
            if not line.startswith('|') or line.startswith('|---') or '| 문항 |' in line: continue
            c = [x.strip() for x in line.strip().strip('|').split('|')]
            if len(c) < 6: continue
            q, mark, grade, tag, memo, rx = c[:6]
            m = re.match(r'(?:(\d{4}-\d))?#?(\d+)$', q)
            if not m: continue
            e, n = m.group(1) or cur, int(m.group(2))
            wrong = bool(re.search(r'✕|✗|무응답|미기재|부분|TTL만|사실상|오답', grade)) and not re.match(r'의견 ?갈림 ?\(키|의견 갈림\(E', grade)
            if grade.startswith('의견') and '무응답' in grade and mark == '○': wrong = False
            if not (wrong or mark in ('△', '✕')): continue
            k = key.get((e, n), {}); cat = k.get('category', '')
            area = AREA.get(cat) or ('pg' if cat.startswith('프로그래밍') else 'x')
            t = re.sub(r'\(\d+회?\)', '', tag).split(';')[0].strip() or k.get('topic', '')
            rows.append(dict(id=f'{e}-{n:02d}', exam=e, no=n, area=area, sub=cat.replace('프로그래밍-', '') if area in ('pg','db') else '',
                             tag=re.sub(r'-(C|Py)$', '', t), kind='틀림' if wrong else '불안', mark=mark,
                             mine=grade.replace('✗', '✕'), memo=memo.strip('— ').strip(), rx=rx))
    return rows

def boxes(pages):
    out = []
    for f in pages:
        a = np.asarray(Image.open(f).convert('RGB')).astype(int)
        L = ((abs(a[:,:,0]-31) < 25) & (abs(a[:,:,1]-77) < 25) & (abs(a[:,:,2]-46) < 25))[:, 60:220]
        rows, y, H = L.sum(1), 0, a.shape[0]
        while y < H:
            if rows[y] > 15:
                y0 = y
                while y < H and rows[y] > 15: y += 1
                xs = np.where(L[y0:y].sum(0) > (y-y0)*0.6)[0]
                w = xs.max()-xs.min()+1 if len(xs) else 0
                if 20 <= y-y0 <= 50 and 24 <= w <= 46: out.append((f, y0))
            y += 1
    return out

def edge(img, y0, y1, last):
    a = np.asarray(img.convert('L').crop((X0, y0, X1, y1)))
    r = np.where((a < 235).sum(1) > 2)[0]
    if not len(r): return None
    return y0 + (r.max()+8 if last else r.min()-8)

def segment(pages, a, b, off):
    ia = pages.index(a[0]); ib = pages.index(b[0]) if b else ia
    pieces = []
    for i in range(ia, ib+1):
        img = Image.open(pages[i]).convert('RGB')
        y0 = a[1]-14 if i == ia else TOP
        y1 = (b[1]-off) if (b and i == ib) else BOT
        if y1 <= y0+20: continue
        if i != ia: y0 = edge(img, y0, y1, False) or y1
        y1 = edge(img, y0, y1, True) or y0
        if y1-y0 > 20: pieces.append(img.crop((X0, y0, X1, y1)))
    out = Image.new('RGB', (X1-X0, sum(p.height for p in pieces)+8*(len(pieces)-1)), 'white'); y = 0
    for p in pieces: out.paste(p, (0, y)); y += p.height+8
    return out.resize((out.width*3//4, out.height*3//4), Image.LANCZOS)

def main(base):
    rows = collect(base)
    os.makedirs(f'{ROOT}/img/wrong', exist_ok=True)
    tmp = tempfile.mkdtemp()
    for e in sorted({r['exam'] for r in rows}):
        y, n = e.split('-')
        pdf = glob.glob(f'{base}/01_실기_기출문제/연도별_복원문제/{y}/{y}_{n}회*.pdf')[0]
        subprocess.run(['pdftoppm', '-r', '150', '-png', '-hide-annotations', pdf, f'{tmp}/{e}'], check=True, stderr=subprocess.DEVNULL)
        pages = sorted(glob.glob(f'{tmp}/{e}-*.png'))
        bx = boxes(pages); q, an = bx[:len(bx)//2], bx[len(bx)//2:]
        assert len(q) == len(an), f'{e}: 번호 상자 {len(bx)}개 — 확인 필요'
        for r in (r for r in rows if r['exam'] == e):
            i = r['no']-1
            for kind, lst, nxt_last in (('q', q, (an[0][0], 60)), ('a', an, None)):
                nxt = lst[i+1] if i+1 < len(lst) else nxt_last
                im = segment(pages, lst[i], nxt, 22 if kind == 'a' else 14)
                path = f"img/wrong/{r['id']}{kind}.webp"
                im.save(f'{ROOT}/{path}', 'WEBP', quality=78, method=6)
                r[kind], r[kind+'w'], r[kind+'h'] = path, im.width, im.height
    json.dump(rows, open(f'{ROOT}/data/wrong.json', 'w'), ensure_ascii=False, indent=1)
    print(len(rows), '문항')

if __name__ == '__main__':
    main(sys.argv[1].rstrip('/'))

# EF Core ლექციის ბილდი: შენიშვნები (მარტივი ტექსტი) → HTML, ნაბიჯების შემოწმება, index.html + script.html
# შენიშვნების პრეფიქსები: "→ " ნაბიჯი · "? " კითხვა · "⏱ " დრო · "! " მნიშვნელოვანი · "~ " ლექტორისთვის
import re, html, pathlib, build

ROOT = pathlib.Path(__file__).parent
TITLE = 'EF Core კონსოლში — ORM, DataContext, მიგრაცია'

def note_html(text):
    out, c = [], 0
    for line in [l.strip() for l in text.strip().split('\n') if l.strip()]:
        if line.startswith('→'):
            c += 1
            out.append(f'<div class="nl cue" data-c="{c}"><span class="ck">→ {c}</span>{html.escape(line[1:].strip())}</div>')
        elif line.startswith('⏱'): out.append(f'<div class="nl t">{html.escape(line)}</div>')
        elif line.startswith('?'): out.append(f'<div class="nl q">❓ {html.escape(line[1:].strip())}</div>')
        elif line.startswith('!'): out.append(f'<div class="nl imp">{html.escape(line[1:].strip())}</div>')
        elif line.startswith('~'): out.append(f'<div class="nl dir">{html.escape(line[1:].strip())}</div>')
        else: out.append(f'<div class="nl say">{html.escape(line)}</div>')
    return ''.join(out), c

def count_steps(slide):
    n = 0
    for tag in re.findall(r'<(?!/)[^>]+>', slide):
        cls = re.search(r'\b(?:class|cls)="([^"]*)"', tag)
        if not cls: continue
        toks = cls.group(1).split()
        if {'step', 'codestep', 'trigger'} & set(toks) and 'data-with' not in tag:
            n += 1
    return n

src = (ROOT / 'ef.html').read_text()
slides = re.findall(r'<section class="slide.*?</section>', src, re.S)
problems, script = [], []
for i, sl in enumerate(slides, 1):
    m = re.search(r'<aside class="notes">(.*?)</aside>', sl, re.S)
    body, cues = note_html(m.group(1)) if m else ('', 0)
    steps = count_steps(re.sub(r'<aside class="notes">.*?</aside>', '', sl, flags=re.S))
    if steps != cues: problems.append(f'slide {i}: steps={steps} cues={cues}')
    h = re.search(r'<h[12][^>]*>(.*?)</h[12]>', sl, re.S)
    script.append((i, re.sub(r'<[^>]+>', ' ', h.group(1)).replace('  ', ' ').strip() if h else '', body))
    src = src.replace(sl, sl.replace(m.group(0), f'<aside class="notes" data-cues="{cues}">{body}</aside>') if m else sl, 1)

print('\n'.join(problems) or f'OK — {len(slides)} slides, steps match cues')
(ROOT / '_ef.src.html').write_text(src)
build.build('_ef.src.html', 'index.html', TITLE, light=True)
(ROOT / '_ef.src.html').unlink()

rows = ''.join(f'<section><h2><span>{n}</span>{t}</h2>{b}</section>' for n, t, b in script)
(ROOT.parent / 'out' / 'script.html').write_text(f'''<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>სცენარი — {TITLE}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;700&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
<style>body{{font:17px/1.6 "Noto Sans Georgian",system-ui,sans-serif;color:#1e2132;background:#fbf8f3;max-width:860px;margin:0 auto;padding:40px 20px}}
h1{{font-size:28px}} section{{background:#fff;border:1px solid #e6dfd2;border-radius:12px;padding:16px 22px;margin:14px 0;break-inside:avoid}}
h2{{font-size:19px;margin:0 0 8px}} h2 span{{display:inline-block;min-width:34px;color:#6d28d9;font-family:"JetBrains Mono",monospace}}
.nl{{margin:3px 0}} .t{{color:#6d28d9;font:600 14px "JetBrains Mono",monospace}} .cue{{color:#0d9488;font-weight:700}} .ck{{margin-right:8px}}
.q{{color:#b45309}} .imp{{color:#15803d;font-weight:700}} .dir{{color:#7b8096;font-style:italic;font-size:15px}}
@media print{{body{{background:#fff}} section{{border-color:#ccc}}}}</style></head>
<body><h1>📜 სცენარი · {TITLE}</h1><p style="color:#7b8096">→ = შემდეგი ნაბიჯი სლაიდზე · ❓ კითხვა აუდიტორიას · მწვანე = ხაზგასასმელი · ნაცრისფერი = მხოლოდ ლექტორისთვის</p>{rows}</body></html>''')
print('built script.html')

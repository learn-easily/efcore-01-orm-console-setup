import re, sys, html, pathlib
from pygments.lexers import get_lexer_by_name
from pygments.token import STANDARD_TYPES

ROOT = pathlib.Path(__file__).parent
CSS = (ROOT / 'engine.css').read_text()
JS = (ROOT / 'engine.js').read_text()

def short(tt):
    while tt not in STANDARD_TYPES:
        tt = tt.parent
    return STANDARD_TYPES[tt]

def hl(code, lang):
    code = code.strip('\n')
    # dedent
    lines = code.split('\n')
    ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    code = '\n'.join(l[ind:] for l in lines)
    if lang == 'plain':
        toks = [(None, code)]
    else:
        lexer = get_lexer_by_name(lang, stripnl=False, ensurenl=False)
        toks = list(lexer.get_tokens(code))
    out_lines = [[]]
    for tt, val in toks:
        cls = short(tt) if tt is not None else ''
        parts = val.split('\n')
        for n, p in enumerate(parts):
            if n > 0:
                out_lines.append([])
            if p:
                e = html.escape(p, quote=False)
                if lang.startswith('aspx') or lang == 'asp':
                    e = re.sub(r'(&lt;%[=#:]?|%&gt;)', r'<span class="asp-delim">\1</span>', e)
                out_lines[-1].append(f'<span class="{cls}">{e}</span>' if cls else e)
    while out_lines and not ''.join(out_lines[-1]).strip():
        out_lines.pop()
    return ''.join(f'<span class="ln">{"".join(l) or " "}</span>' for l in out_lines)

def code_block(m):
    attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
    body = hl(m.group(2), attrs.get('lang', 'plain'))
    idattr = f' id="{attrs["id"]}"' if 'id' in attrs else ''
    cls = 'code ' + attrs.get('cls', '')
    style = f' style="{attrs["style"]}"' if 'style' in attrs else ''
    ttl = f'<span class="ttl">{attrs["title"]}</span>' if 'title' in attrs else ''
    w = ' data-with' if 'data-with' in m.group(1) else ''
    return f'<pre class="{cls.strip()}"{idattr}{style}{w}>{ttl}<code>{body}</code></pre>'

LIGHT_MAP = [  # dark-theme SVG colours -> light-theme equivalents (applied to slide markup)
    ('#151935', '#ffffff'), ('#1b1f3d', '#f1ece3'), ('#0a0c16', '#fbf8f3'), ('#0d1024', '#ffffff'), ('#e8ecff', '#dbeafe'),
    ('#1d1640', '#f3effe'), ('#2a1d4d', '#ede7fd'), ('#0e2a33', '#eaf2fe'), ('#33240b', '#fef5e4'), ('#123321', '#eaf8ef'),
    ('#272c52', '#e6dfd2'), ('#353b6b', '#cfc6b6'),
    ('#22d3ee', '#2563eb'), ('#3b82f6', '#2563eb'), ('#22c55e', '#16a34a'), ('#f5a524', '#d97706'), ('#8b6cff', '#6d28d9'),
    ('#ec4899', '#db2777'), ('#f43f5e', '#dc2626'), ('#a78bfa', '#0d9488'),
    ('rgba(34,211,238,', 'rgba(37,99,235,'), ('rgba(59,130,246,', 'rgba(37,99,235,'), ('rgba(34,197,94,', 'rgba(22,163,74,'),
    ('rgba(245,165,36,', 'rgba(217,119,6,'), ('rgba(244,63,94,', 'rgba(220,38,38,'), ('rgba(167,139,250,', 'rgba(13,148,136,'),
    ('rgba(139,108,255,', 'rgba(109,40,217,'),
]

def build(src, out, title, light=False):
    s = (ROOT / src).read_text()
    css = CSS + ('\n' + (ROOT / 'theme-light.css').read_text() if light else '')
    if light:
        for a, b in LIGHT_MAP:
            s = s.replace(a, b).replace(a.upper(), b)
    s = re.sub(r'<code-block([^>]*)>(.*?)</code-block>', code_block, s, flags=re.S)
    page = f'''<!doctype html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>{css}
.slide .notes{{display:none}}</style></head>
<body>
<div id="stage"><div id="deck">
{s}
<div id="hud"><span class="sec"></span><span class="dots"></span><span class="num"></span></div><div id="bar"></div>
</div></div>
<div id="notes"></div><div id="overview"></div>
<div id="help">← → · F</div>
<script>{JS}</script>
</body></html>'''
    (ROOT.parent / 'out').mkdir(exist_ok=True)
    (ROOT.parent / 'out' / out).write_text(page)
    print('built', out, len(page))

if __name__ == '__main__':
    which = sys.argv[1:] or ['3']
    if '1' in which:
        build('l1.html', 'lecture-01-history-architecture.html', 'ლექცია 1 — Back-end-ის ისტორია და ვებ არქიტექტურა')
    if '3' in which:
        build('l3.html', 'lecture-01-backend-api-rest.html', 'ლექცია 1 — Backend, API, REST და პირველი Web API', light=True)
    if '2' in which:
        build('l2.html', 'lecture-02-aspnetcore-web-api.html', 'ლექცია 2 — ASP.NET Core და პირველი Web API')

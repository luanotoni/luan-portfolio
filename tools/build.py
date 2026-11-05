"""Assemble index.html from src.html.

Inlines the pixel invader, and prerenders the GitHub projects so the page has
them even without JavaScript. The browser refreshes the list live on every visit
(js/site.js), so this script only needs to run when src.html changes.
"""
import html
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parent.parent
USER = "luanotoni"
SNAPSHOT = root / "assets" / "repos.json"
NEXT_TOPICS = {"proximo", "em-construcao"}

INVADER = """  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <symbol id="ship" viewBox="-34 -15 66 30">
      <path class="ship-flame" d="M-21 -1.4 L-33 0 L-21 1.4 Z"/>
      <path class="hull-m" d="M3 -3 L-11 -14 L-16 -13 L-10 -2.5 Z M3 3 L-11 14 L-16 13 L-10 2.5 Z"/>
      <path class="hull-l" d="M30 0 L6 -4.2 L-17 -3.4 L-21 0 L-17 3.4 L6 4.2 Z"/>
      <path class="hull-d" d="M30 0 L6 1.2 L-17 1.4 L-21 0 L-17 3.4 L6 4.2 Z"/>
      <path class="ship-stripe" d="M-15 -0.5 H18 V0.5 H-15 Z"/>
      <ellipse class="glass" cx="11" cy="0" rx="5" ry="1.9"/>
    </symbol>
    <symbol id="invader" viewBox="0 0 11 8"><path fill="currentColor" d="M2 0h1v1h-1zM8 0h1v1h-1zM3 1h1v1h-1zM7 1h1v1h-1zM2 2h7v1h-7zM1 3h2v1h-2zM4 3h3v1h-3zM8 3h2v1h-2zM0 4h11v1h-11zM0 5h1v1h-1zM2 5h7v1h-7zM10 5h1v1h-1zM0 6h1v1h-1zM2 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM3 7h2v1h-2zM6 7h2v1h-2z"/></symbol>
  </defs></svg>"""


def fetch_repos():
    """Live list from the GitHub API; falls back to the last snapshot when offline or rate limited."""
    url = f"https://api.github.com/users/{USER}/repos?per_page=100&sort=pushed"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": f"{USER}-portfolio-build"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = json.load(r)
        keep = ["name", "description", "html_url", "homepage", "language", "topics", "stargazers_count", "pushed_at", "fork", "archived"]
        repos = [{k: x.get(k) for k in keep} for x in raw]
        SNAPSHOT.write_text(json.dumps({"saved": datetime.now(timezone.utc).isoformat(timespec="seconds"), "repos": repos}, ensure_ascii=False, indent=1) + "\n")
        return repos
    except Exception as err:  # offline build
        print(f"GitHub indisponível ({err}); usando {SNAPSHOT.name}")
        return json.loads(SNAPSHOT.read_text())["repos"]


def visible(repos):
    return [r for r in repos if not r["fork"] and not r["archived"] and r["name"] != USER and "oculto" not in (r["topics"] or [])]


def row(r):
    e = html.escape
    desc = f'<p>{e(r["description"])}</p>' if r["description"] else ""
    lang = f'<span>{e(r["language"])}</span>' if r["language"] else ""
    return (f'<li class="repo"><h3><a href="{e(r["html_url"])}" target="_blank" rel="noopener">{e(r["name"])}</a></h3>'
            f'{desc}<p class="repo-meta">{lang}<span>push em {r["pushed_at"][:10]}</span></p></li>')


def prerender(repos):
    shown = visible(repos)
    nxt = [r for r in shown if NEXT_TOPICS & set(r["topics"] or [])]
    rest = [r for r in shown if r not in nxt]
    out = ['<ol class="repo-list">', *(row(r) for r in rest), "</ol>"]
    if nxt:
        out += ['<h3 class="next-h">Próximos</h3><ol class="repo-list">', *(row(r) for r in nxt), "</ol>"]
    return "\n".join("          " + line for line in out)


def pulse(repos):
    shown = visible(repos)
    if not shown:
        return ""
    last = max(shown, key=lambda r: r["pushed_at"])
    return f'Último push em <a href="{html.escape(last["html_url"])}" target="_blank" rel="noopener">{html.escape(last["name"])}</a>, {last["pushed_at"][:10]}.'


repos = fetch_repos()
page = (root / "src.html").read_text()
page = page.replace("<!--SHIPS-->", INVADER)
page = page.replace("<!--REPOS-->", prerender(repos))
page = page.replace("<!--PULSE-->", pulse(repos))
(root / "index.html").write_text(page)
print(f"index.html: {len(page):,} bytes, {len(visible(repos))} projetos")

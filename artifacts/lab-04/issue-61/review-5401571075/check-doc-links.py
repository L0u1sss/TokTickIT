import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

evidence = Path(__file__).resolve().parent
root = evidence.parents[3]
files = [root / "README.md"] + [root / "docs/lab-04" / name for name in [
    "report.md", "release-audit.md", "pr-61-description.md", "reviewer.md", "ai-use.md", "tests.md",
]]
checked = 0
failures = []
for document in files:
    for raw in re.findall(r"!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)", document.read_text(encoding="utf-8")):
        link = raw.strip("<>")
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        target = (document.parent / unquote(parsed.path)).resolve() if parsed.path else document
        checked += 1
        if not target.exists():
            failures.append({"document": document.relative_to(root).as_posix(), "target": link})
result = {"scope": "updated release documentation local link targets", "checked": checked,
          "missing": failures, "checksPassed": not failures}
(evidence / "doc-link-checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
assert not failures

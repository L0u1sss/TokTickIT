import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

evidence = Path(__file__).resolve().parent
root = evidence.parents[3]
pdf = evidence / "pdf-smoke/SE-Lab4-67070507212.pdf"
reader = PdfReader(pdf)
texts = [page.extract_text() for page in reader.pages]
text = "\n".join(texts)
links = [str(a.get_object().get("/A", {}).get("/URI"))
         for page in reader.pages for a in page.get("/Annots", [])
         if a.get_object().get("/A", {}).get("/URI")]
original = root / "docs/lab-04/SE-Lab4-67070507212.pdf"
result = {
    "status": "release-candidate",
    "pageCount": len(reader.pages),
    "answerParts": sorted(set(int(x) for x in re.findall(r"Answer Part\s+(\d+)", text))),
    "pdfLinkCount": len(links),
    "uniqueUrlCount": len(set(links)),
    "candidateFooterPages": sum("Release candidate" in t and "final main pending" in t for t in texts),
    "thaiCharacters": sum("\u0e00" <= c <= "\u0e7f" for c in text),
    "smokePdfSha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
    "originalCandidateSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
}
result["checksPassed"] = (
    result["pageCount"] == 21
    and result["answerParts"] == list(range(1, 10))
    and result["pdfLinkCount"] == 64
    and result["uniqueUrlCount"] == 31
    and result["candidateFooterPages"] == 21
    and result["thaiCharacters"] > 1000
    and result["originalCandidateSha256"] == "29455b6226bca8a5a934039dba9dd4fc751e1570548be439aab00d6d7962ff6e"
)
(evidence / "pdf-smoke-checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
assert result["checksPassed"]

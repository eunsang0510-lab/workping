import re
import difflib


def _tokenize(text: str) -> list[str]:
    """공백을 보존하며 단어 단위로 분리 (whitespace 토큰도 별도 유지)."""
    return re.split(r"(\s+)", text or "")


def word_diff(original: str, current: str) -> list[dict]:
    """original(AI 생성본) 대비 current(사용자 수정본)의 변경 구간을 반환.

    반환값: [{"type": "equal" | "insert" | "delete", "text": "..."}, ...]
    프론트에서 insert는 강조색, delete는 취소선으로 렌더링해 "무엇을 고쳤는지" 보여준다.
    """
    if original is None:
        original = ""
    if current is None:
        current = ""
    if original == current:
        return [{"type": "equal", "text": current}] if current else []

    a = _tokenize(original)
    b = _tokenize(current)
    matcher = difflib.SequenceMatcher(None, a, b, autojunk=False)

    segments: list[dict] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            segments.append({"type": "equal", "text": "".join(b[j1:j2])})
        elif tag == "delete":
            segments.append({"type": "delete", "text": "".join(a[i1:i2])})
        elif tag == "insert":
            segments.append({"type": "insert", "text": "".join(b[j1:j2])})
        elif tag == "replace":
            segments.append({"type": "delete", "text": "".join(a[i1:i2])})
            segments.append({"type": "insert", "text": "".join(b[j1:j2])})
    return segments

"""회의록 기능: 음성 → 텍스트(STT) 추출, 텍스트 → AI 요약/할일 추출."""
import uuid
from typing import List
from pydantic import BaseModel
from openai import OpenAI
import anthropic

STT_MODEL = "gpt-4o-mini-transcribe"
SUMMARY_MODEL = "claude-sonnet-5"

SYSTEM_PROMPT = """당신은 회사 회의록을 정리해주는 어시스턴트입니다.
입력은 회의 녹음을 음성인식(STT)으로 변환한 텍스트입니다. 화자 구분은 되어 있지 않고,
인식 오류로 어색한 단어가 섞여 있을 수 있으니 문맥상 자연스럽게 보정해서 이해하세요.

다음 두 가지를 작성하세요.
1. summary: 회의 핵심 내용 요약. 논의 주제, 주요 의견, 결정사항 위주로 한국어 문단/불릿으로 간결하게.
   잡담이나 인식 오류로 보이는 무의미한 문장은 제외하세요.
2. todos: 회의에서 언급된 실행 항목(할 일)을 짧고 구체적인 한국어 문장으로 추출. 없으면 빈 배열.
"""


class _TodoItem(BaseModel):
    text: str


class _MeetingAnalysis(BaseModel):
    summary: str
    todos: List[_TodoItem]


def transcribe_audio(file_bytes: bytes, filename: str, content_type: str | None) -> str:
    """녹음 파일을 텍스트로 변환. 오디오 원본은 여기서만 잠깐 메모리에 머물고 저장하지 않는다."""
    client = OpenAI()
    result = client.audio.transcriptions.create(
        model=STT_MODEL,
        file=(filename or "recording.webm", file_bytes, content_type or "audio/webm"),
        response_format="text",
        language="ko",
    )
    text = result if isinstance(result, str) else getattr(result, "text", "")
    return (text or "").strip()


PROGRESS_SYSTEM_PROMPT = """당신은 팀의 여러 회의록을 훑어보고 지금 어떤 일이 어떤 상태로 진행 중인지 정리해주는 어시스턴트입니다.
입력은 시간순(오래된 것 → 최신)으로 정렬된 여러 회의의 [날짜/제목/요약/할 일] 목록입니다.
같은 주제가 여러 회의에 걸쳐 반복해서 언급될 수 있습니다 — 이를 하나의 작업(work item)으로 묶어서 추적하세요.

다음을 작성하세요.
1. overview: 팀 전체 진행 상황에 대한 2~4문장 요약.
2. items: 회의들을 관통하는 주요 작업/안건 목록. 각 항목은
   - topic: 작업/안건 이름 (짧게)
   - status: "진행중" | "완료" | "보류" 중 하나 (최신 회의 기준으로 판단)
   - description: 어떻게 진행되어 왔고 지금 상태가 어떤지 1~3문장

너무 사소하거나 한 번만 언급되고 후속 언급이 없는 잡담성 안건은 items에서 제외하세요.
"""


class _ProgressItem(BaseModel):
    topic: str
    status: str
    description: str


class _ProgressAnalysis(BaseModel):
    overview: str
    items: List[_ProgressItem]


def analyze_progress(meetings_text: str) -> tuple[str, list[dict]]:
    """여러 회의의 요약/할일을 모아 Claude에 보내 팀 진행 현황을 재구성."""
    if not meetings_text.strip():
        return "", []

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=4096,
        system=PROGRESS_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": meetings_text,
        }],
        output_format=_ProgressAnalysis,
    )
    analysis = response.parsed_output
    items = [
        {"topic": i.topic.strip(), "status": i.status.strip(), "description": i.description.strip()}
        for i in analysis.items if i.topic.strip()
    ]
    return analysis.overview.strip(), items


def summarize_meeting(transcript: str) -> tuple[str, list[dict]]:
    """텍스트를 Claude에 보내 요약 + 할일 목록을 생성."""
    if not transcript.strip():
        return "", []

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"[회의 STT 텍스트]\n{transcript}",
        }],
        output_format=_MeetingAnalysis,
    )
    analysis = response.parsed_output
    todos = [{"id": str(uuid.uuid4()), "text": t.text} for t in analysis.todos if t.text.strip()]
    return analysis.summary.strip(), todos

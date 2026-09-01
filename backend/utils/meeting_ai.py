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


CAREER_SYSTEM_PROMPT = """당신은 인사평가에서 직원의 계획을 보고 커리어 성장 방향을 조언하는 어시스턴트입니다.
입력으로 그 사람의 직무와, 이번 평가 기간에 작성한 계획(성과/역량) 내용이 주어집니다.
계획 내용을 바탕으로 이 사람이 그 직무에서 어떤 방향으로 성장하면 좋을지, 강점으로 보이는 부분과
더 키우면 좋을 역량을 짚어서 2~4문단의 한국어로 조언하세요. 평가하듯 딱딱하게 쓰지 말고 성장을 돕는 코칭 톤으로 쓰세요.
"""


class _TextResult(BaseModel):
    text: str


def analyze_career(job_title: str, plan_text: str) -> str:
    """직무 + 계획 내용을 보고 커리어 성장 방향을 텍스트로 조언."""
    if not plan_text.strip():
        return ""

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=1500,
        system=CAREER_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"[직무] {job_title}\n\n[이번 평가 기간 계획]\n{plan_text}",
        }],
        output_format=_TextResult,
    )
    return response.parsed_output.text.strip()


GROWTH_SYSTEM_PROMPT = """당신은 인사평가에서 직원의 계획 대비 실적을 분석하는 어시스턴트입니다.
입력으로 그 사람의 직무, 이번 기간 계획, 이번 기간 실적이 주어집니다.

다음 두 가지를 작성하세요.
1. analysis: 계획 대비 실적을 보고 이 사람이 그 직무에 얼마나 잘 맞게 업무를 수행했는지,
   이전 대비 어떻게 성장했는지 2~4문단으로 분석 (코칭 톤, 너무 박하거나 후하지 않게 균형있게).
2. competencies: 그 직무 종사자에게 일반적으로 중요한 역량 5~7개를 당신의 지식을 바탕으로 선정하고,
   이번 실적 내용을 근거로 각 역량을 0~100점으로 추정 평가하세요 (같은 직무의 평균적인 숙련자를 50~60점 기준으로 상대 비교).
   axis는 역량 이름(짧게), score는 0~100 정수.
"""


class _CompetencyAxis(BaseModel):
    axis: str
    score: int


class _GrowthAnalysis(BaseModel):
    analysis: str
    competencies: List[_CompetencyAxis]


def analyze_growth(job_title: str, plan_text: str, actual_text: str) -> tuple[str, list[dict]]:
    """직무 + 계획 + 실적을 보고 성장/직무적합도 분석과 역량 레이더 데이터를 생성."""
    if not actual_text.strip():
        return "", []

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=2000,
        system=GROWTH_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"[직무] {job_title}\n\n[이번 기간 계획]\n{plan_text}\n\n[이번 기간 실적]\n{actual_text}",
        }],
        output_format=_GrowthAnalysis,
    )
    parsed = response.parsed_output
    competencies = [
        {"axis": c.axis.strip(), "score": max(0, min(100, c.score))}
        for c in parsed.competencies if c.axis.strip()
    ]
    return parsed.analysis.strip(), competencies


ONE_ON_ONE_SYSTEM_PROMPT = """당신은 인사평가 담당자를 도와 평가자-피평가자 1on1 면담 녹음을 검수하는 어시스턴트입니다.
입력은 1on1 면담을 음성인식(STT)한 텍스트입니다(화자 구분 없음, 인식 오류 있을 수 있음).

이 면담이 평가 면담으로서 제대로 이루어졌는지, 관리 감독자 관점에서 짧게 평가하세요.
다음을 포함하세요.
- 평가자가 피평가자의 실적/계획 내용을 구체적으로 짚어가며 대화했는지
- 피평가자에게 충분히 설명하고 의견을 들을 기회를 줬는지 (일방적 통보는 아니었는지)
- 개선점이나 다음 기간 방향에 대한 논의가 있었는지
- 미흡해 보이는 부분이 있다면 구체적으로 지적

2~4문단의 한국어로, 평가자를 검수하는 관리자에게 보고하듯 작성하세요.
"""


def analyze_one_on_one(transcript: str) -> str:
    """1on1 면담 녹음 텍스트를 보고 면담 품질을 관리자 관점에서 분석."""
    if not transcript.strip():
        return ""

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=1500,
        system=ONE_ON_ONE_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"[1on1 면담 STT 텍스트]\n{transcript}",
        }],
        output_format=_TextResult,
    )
    return response.parsed_output.text.strip()


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

"""근로시간 패턴 분석: 주간 근태 추이를 보고 주/월 최대 근로시간 초과 위험을 AI가 판단."""
from pydantic import BaseModel
import anthropic

SUMMARY_MODEL = "claude-sonnet-5"

WORK_HOUR_SYSTEM_PROMPT = """당신은 회사의 근태 데이터를 보고 근로기준 초과 위험을 판단하는 어시스턴트입니다.
입력으로 한 직원의 최근 몇 주간 주간 근무시간 추이, 이번 달 누적 근무시간, 회사가 정한 주/월 최대 근로시간 기준이 주어집니다.

다음을 판단하세요.
1. at_risk: 이 사람이 앞으로 주 최대 또는 월 최대 근로시간을 초과할 가능성이 있는지 (이미 초과했다면 당연히 true).
   단순히 이번 주 숫자만 보지 말고 최근 추세(계속 늘고 있는지, 이미 여러 주 연속 높은 수준을 유지하고 있는지)를 함께 고려하세요.
2. message: at_risk가 true라면, 본인이 보면 바로 이해할 수 있는 1~2문장의 한국어 알림 메시지를 작성하세요.
   어떤 기준(주/월)이 위험한지, 최근 추세가 어땠는지 짧고 구체적으로 언급하세요. at_risk가 false면 빈 문자열로 두세요.
"""


class _WorkHourRisk(BaseModel):
    at_risk: bool
    message: str


def analyze_work_hour_risk(weekly_pattern_text: str) -> tuple[bool, str]:
    """근로시간 추이 텍스트를 보고 초과 위험 여부와 알림 메시지를 생성."""
    if not weekly_pattern_text.strip():
        return False, ""

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=SUMMARY_MODEL,
        max_tokens=500,
        system=WORK_HOUR_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": weekly_pattern_text}],
        output_format=_WorkHourRisk,
    )
    parsed = response.parsed_output
    return parsed.at_risk, parsed.message.strip()

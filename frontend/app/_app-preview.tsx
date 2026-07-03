"use client";
import { useState } from "react";

export default function AppPreview() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = ["대시보드", "달력", "리포트", "연차", "출장", "팀장"];

  const mockups = [
    // ── 대시보드 ──────────────────────────────────────────
    <div key="dashboard" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
          <span className="text-[#a0a0a0] text-[10px] font-medium">워크핑 주식회사</span>
        </div>
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">👤</div>
      </div>

      {/* 메인 카드 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">5월 15일 (목)</div>
            <div className="text-[#0a0a0a] text-3xl font-black tracking-tight">6h 42m</div>
            <div className="text-[#6b6b6b] text-xs mt-1">📍 강남구 테헤란로 427</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-2 py-1">
              <span className="text-[#16a34a] text-xs font-bold">근무중</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] text-xs font-medium">
              🏠 재택근무
            </div>
          </div>
        </div>
        <div className="flex gap-4 pt-3 border-t border-[#e5e5e5]">
          {[["출근", "09:15", "#16a34a"], ["퇴근", "--:--", "#a0a0a0"]].map(([label, val, color]) => (
            <div key={label}>
              <div className="text-[#a0a0a0] text-xs mb-0.5">{label}</div>
              <div className="text-xs font-bold" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#5b5ef4] rounded-xl py-3 text-center text-white text-xs font-bold shadow-[0_4px_12px_rgba(91,94,244,0.3)] opacity-40">📍 출근하기</div>
        <div className="bg-white border border-[#e5e5e5] rounded-xl py-3 text-center text-[#6b6b6b] text-xs font-bold">🏠 퇴근하기</div>
      </div>

      {/* 오늘의 기록 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">오늘의 기록</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
          <div>
            <div className="text-[#0a0a0a] text-xs font-medium">출근</div>
            <div className="text-[#6b6b6b] text-xs">09:15 · 재택 (승인된 주소)</div>
          </div>
        </div>
      </div>

      {/* 메뉴 카드 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          ["🏖️", "연차관리", "신청 및 내역"],
          ["✈️", "출장신청", "출장 신청 및 현황"],
          ["🗓️", "달력", "근로 기록"],
          ["📊", "리포트", "주간/월간"],
          ["📢", "공지사항", "전체 공지 보기"],
          ["👑", "팀장권한", "팀원 승인 및 현황"],
          ["🏢", "관리자", "팀 현황"],
        ].map(([icon, title, sub]) => (
          <div key={title} className="bg-white border border-[#e5e5e5] rounded-xl p-3 flex items-center gap-2 shadow-sm">
            <span className="text-base">{icon}</span>
            <div>
              <div className="text-[#0a0a0a] text-xs font-bold">{title}</div>
              <div className="text-[#6b6b6b] text-xs">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,

    // ── 달력 ──────────────────────────────────────────────
    <div key="calendar" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#6b6b6b] text-sm">‹</span>
          <span className="text-[#0a0a0a] font-black text-sm">2026년 5월</span>
          <span className="text-[#6b6b6b] text-sm">›</span>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {["일","월","화","수","목","금","토"].map((w, i) => (
            <div key={w} className={`text-center text-xs font-bold py-0.5 ${i===0?"text-[#ef4444]":i===6?"text-[#5b5ef4]":"text-[#a0a0a0]"}`}>{w}</div>
          ))}
        </div>
        {/* 연차(5~7, 초록), 출장(12~13, 주황) 줄선 표시 */}
        <div className="grid grid-cols-7">
          {[null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31].map((d, i) => {
            const leaveDays = [5,6,7];
            const tripDays  = [12,13];
            const hasLeave = d !== null && leaveDays.includes(d);
            const hasTrip  = d !== null && tripDays.includes(d);
            const leavePos = d===5?'start':d===7?'end':'mid';
            const tripPos  = d===12?'start':'end';
            const attendanceDays = [1,2,8,9,14,15,16,19,20,21,22,23];
            const hasAttendance = d !== null && attendanceDays.includes(d);
            const isSelected = d === 7;
            return (
              <div key={i} className="flex flex-col">
                <div className={`relative mx-auto flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold
                  ${isSelected?"bg-[#5b5ef4] text-white shadow-sm":""}
                  ${!isSelected&&d?"text-[#0a0a0a]":""}
                `}>
                  {d}
                  {hasAttendance && (
                    <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected?"bg-white":"bg-[#5b5ef4]"}`} />
                  )}
                </div>
                {/* 연차 바 */}
                <div className={`w-full h-[3px] mt-px ${hasLeave?"bg-[#16a34a]":"opacity-0"} ${
                  hasLeave?(leavePos==="start"?"ml-[5px] rounded-l-full":leavePos==="end"?"mr-[5px] rounded-r-full"):""}
                `} />
                {/* 출장 바 */}
                <div className={`w-full h-[3px] mt-px ${hasTrip?"bg-[#f59e0b]":"opacity-0"} ${
                  hasTrip?(tripPos==="start"?"ml-[5px] rounded-l-full":"mr-[5px] rounded-r-full"):""}
                `} />
              </div>
            );
          })}
        </div>
        {/* 범례 */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#f0f0f0]">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-[3px] rounded-full bg-[#16a34a]" />
            <span className="text-[#6b6b6b] text-xs">연차</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-[3px] rounded-full bg-[#f59e0b]" />
            <span className="text-[#6b6b6b] text-xs">출장</span>
          </div>
        </div>
      </div>
      {/* 선택 날짜 상세 — 연차 기간 중 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">2026-05-07</div>
        <div className="flex items-stretch gap-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-3 py-2 mb-2">
          <div className="w-[3px] self-stretch rounded-full bg-[#16a34a] shrink-0" />
          <div>
            <div className="text-[#16a34a] text-[10px] font-bold mb-0.5">연차</div>
            <div className="text-[#0a0a0a] text-xs font-bold">연차 3일</div>
            <div className="text-[#6b6b6b] text-xs">05/05 ~ 05/07</div>
          </div>
        </div>
        <div className="text-center py-2 text-[#a0a0a0] text-xs">출퇴근 기록 없음</div>
      </div>
    </div>,

    // ── 리포트 ────────────────────────────────────────────
    <div key="report" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      <div className="flex bg-white border border-[#e5e5e5] rounded-xl p-1 mb-3 shadow-sm">
        {["주간", "월간"].map((t, i) => (
          <div key={t} className={`flex-1 text-center text-xs font-bold py-1.5 rounded-lg ${i===0?"bg-[#5b5ef4] text-white":"text-[#a0a0a0]"}`}>{t}</div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["총 근무", "42h 30m", "#5b5ef4"], ["근무일수", "5일", "#16a34a"], ["평균", "8h 30m", "#f59e0b"]].map(([label, val, color]) => (
          <div key={label} className="bg-white border border-[#e5e5e5] rounded-xl p-3 text-center shadow-sm">
            <div className="text-[#a0a0a0] text-xs mb-1">{label}</div>
            <div className="font-black text-sm" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">일별 기록</div>
        <div className="space-y-2">
          {[
            ["05/15 (목)", "09:15", "진행중", "6h 42m", true],
            ["05/14 (수)", "09:00", "18:05", "9h 5m", false],
            ["05/13 (화)", "09:10", "17:50", "8h 40m", false],
            ["05/12 (월)", "08:55", "17:30", "8h 35m", false],
            ["05/09 (금)", "09:05", "17:45", "8h 40m", false],
          ].map(([date, ci, co, wh, isRemote]) => (
            <div key={date as string} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <div className="text-[#6b6b6b] text-xs flex items-center gap-1">
                {date}
                {isRemote && <span className="bg-[#e0f2fe] text-[#0369a1] text-xs px-1 rounded">재택</span>}
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-[#16a34a] font-medium">{ci}</span>
                <span className="text-[#a0a0a0]">→</span>
                <span className="text-[#ef4444] font-medium">{co}</span>
              </div>
              <div className="text-[#5b5ef4] text-xs font-bold">{wh}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-[#16a34a] text-xs font-bold">📥 엑셀 다운로드</span>
        <span className="text-[#16a34a] text-xs">→</span>
      </div>
    </div>,

    // ── 연차 ──────────────────────────────────────────────
    <div key="leave" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>
      <div className="bg-[#5b5ef4] rounded-2xl p-4 mb-3 shadow-[0_4px_16px_rgba(91,94,244,0.3)]">
        <div className="text-white/70 text-xs mb-1">2026년 연차 현황</div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-white text-4xl font-black">11</span>
          <span className="text-white/70 text-sm mb-1">일 남음</span>
        </div>
        <div className="flex gap-4">
          {[["총 부여", "15일"], ["사용", "4일"], ["잔여", "11일"]].map(([label, val]) => (
            <div key={label}>
              <div className="text-white/60 text-xs">{label}</div>
              <div className="text-white text-xs font-bold">{val}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-dashed border-[#5b5ef4] rounded-xl py-3 text-center text-[#5b5ef4] text-xs font-bold mb-3">
        + 연차 신청
      </div>
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">신청 내역</div>
        <div className="space-y-2">
          {[
            ["연차 2일", "04/28 ~ 04/29", "승인", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["반차 (오전)", "05/07", "승인", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["연차 1일", "05/26", "대기중", "#854d0e", "#fef9c3", "#fde047"],
          ].map(([type, date, status, color, bg, border]) => (
            <div key={date} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <div>
                <div className="text-[#0a0a0a] text-xs font-bold">{type}</div>
                <div className="text-[#a0a0a0] text-xs">{date}</div>
              </div>
              <div className="px-2 py-0.5 rounded-lg text-xs font-bold border" style={{ color, backgroundColor: bg, borderColor: border }}>
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // ── 출장 ──────────────────────────────────────────────
    <div key="trip" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <span className="text-[#0a0a0a] text-base font-black">Work<span className="text-[#5b5ef4]">Ping</span></span>
        <div className="w-7" />
      </div>

      {/* 신청 폼 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 mb-3 shadow-sm">
        <div className="text-[#0a0a0a] text-xs font-black mb-3">✈️ 출장 신청</div>
        <div className="space-y-2 mb-3">
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">목적지</div>
            <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs text-[#0a0a0a]">부산 해운대구 클라이언트 사무소</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">시작일</div>
              <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs text-[#0a0a0a]">2026-05-20</div>
            </div>
            <div>
              <div className="text-[#a0a0a0] text-xs mb-1">종료일</div>
              <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs text-[#0a0a0a]">2026-05-21</div>
            </div>
          </div>
          <div>
            <div className="text-[#a0a0a0] text-xs mb-1">사유 (선택)</div>
            <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs text-[#a0a0a0]">사유 입력...</div>
          </div>
        </div>
        <div className="bg-[#5b5ef4] text-white text-xs font-bold py-2.5 rounded-xl text-center shadow-[0_4px_12px_rgba(91,94,244,0.3)]">출장 신청하기</div>
      </div>

      {/* 신청 내역 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-4 shadow-sm">
        <div className="text-[#a0a0a0] text-xs font-semibold mb-3 uppercase tracking-wider">신청 내역</div>
        <div className="space-y-2">
          {[
            ["부산 출장", "05/20 ~ 05/21", "대기중", "#854d0e", "#fef9c3", "#fde047"],
            ["대전 고객사 방문", "04/30", "승인", "#16a34a", "#f0fdf4", "#bbf7d0"],
            ["인천 물류센터", "04/10", "승인", "#16a34a", "#f0fdf4", "#bbf7d0"],
          ].map(([title, date, status, color, bg, border]) => (
            <div key={date} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <div>
                <div className="text-[#0a0a0a] text-xs font-bold">{title}</div>
                <div className="text-[#a0a0a0] text-xs">{date}</div>
              </div>
              <div className="px-2 py-0.5 rounded-lg text-xs font-bold border" style={{ color, backgroundColor: bg, borderColor: border }}>
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // ── 팀장 권한 ─────────────────────────────────────────
    <div key="manager" className="bg-[#f4f4f8] rounded-3xl p-4 text-left">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center text-xs">←</div>
        <div>
          <div className="text-[#0a0a0a] text-sm font-black">팀장 권한</div>
          <div className="text-[#6b6b6b] text-xs">연차·출장 승인 및 근태현황</div>
        </div>
      </div>

      {/* 4탭 내비게이션 */}
      <div className="grid grid-cols-4 bg-white border border-[#e5e5e5] rounded-xl p-0.5 mb-3 shadow-sm gap-0.5">
        {[{label:"연차",badge:2},{label:"출장",badge:1},{label:"근태",badge:0},{label:"현황",badge:0}].map((t, i) => (
          <div key={t.label} className={`py-1.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-0.5 ${i===0?"bg-[#5b5ef4] text-white":"text-[#6b6b6b]"}`}>
            {t.label}
            {t.badge > 0 && <span className={`text-[10px] px-1 rounded-full font-black ${i===0?"bg-white/30 text-white":"bg-[#ef4444] text-white"}`}>{t.badge}</span>}
          </div>
        ))}
      </div>

      {/* 대기 중 */}
      <div className="text-[#a0a0a0] text-xs font-semibold px-0.5 mb-2 uppercase tracking-wider">대기 중 (2)</div>

      {/* 취소 신청 항목 — 오렌지 테두리 */}
      <div className="bg-white border border-[#fed7aa] rounded-2xl p-3 mb-2 shadow-sm">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[#0a0a0a] text-xs font-bold">이서연 · 연차 3일</div>
            <div className="text-[#6b6b6b] text-xs">05/05 ~ 05/07</div>
            <div className="text-[#c2410c] text-[10px] mt-0.5 font-medium">취소 신청이 들어왔어요</div>
          </div>
          <span className="text-[10px] font-bold text-[#c2410c] bg-[#fff7ed] border border-[#fed7aa] px-1.5 py-0.5 rounded-full shrink-0">취소신청</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#ef4444] text-white text-xs font-bold py-1.5 rounded-lg text-center">취소 승인</div>
          <div className="flex-1 bg-white border border-[#e5e5e5] text-[#6b6b6b] text-xs font-bold py-1.5 rounded-lg text-center">취소 반려</div>
        </div>
      </div>

      {/* 일반 대기 항목 */}
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-3 mb-3 shadow-sm">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[#0a0a0a] text-xs font-bold">김민준 · 연차 1일</div>
            <div className="text-[#6b6b6b] text-xs">05/26 · 개인 사정</div>
          </div>
          <span className="text-[10px] font-bold text-[#854d0e] bg-[#fef9c3] border border-[#fde047] px-1.5 py-0.5 rounded-full shrink-0">대기</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#5b5ef4] text-white text-xs font-bold py-1.5 rounded-lg text-center">승인</div>
          <div className="flex-1 bg-white border border-[#fecaca] text-[#ef4444] text-xs font-bold py-1.5 rounded-lg text-center">반려</div>
        </div>
      </div>

      {/* 처리 완료 */}
      <div className="text-[#a0a0a0] text-xs font-semibold px-0.5 mb-2 uppercase tracking-wider">처리 완료</div>
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-3 mb-3 shadow-sm opacity-70">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#0a0a0a] text-xs font-bold">박지호 · 연차 2일</div>
            <div className="text-[#6b6b6b] text-xs">04/28 ~ 04/29</div>
          </div>
          <span className="text-[10px] font-bold text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] px-1.5 py-0.5 rounded-full">승인</span>
        </div>
      </div>

      {/* 오늘 근태 요약 */}
      <div className="text-[#a0a0a0] text-xs font-semibold px-0.5 mb-2 uppercase tracking-wider">오늘 근태 (실시간)</div>
      <div className="grid grid-cols-4 gap-1.5">
        {[["출근중","5","#16a34a","#f0fdf4"],["퇴근","2","#5b5ef4","#f5f5ff"],["미출근","1","#a0a0a0","#f8f8f8"],["미퇴근","0","#f59e0b","#fffbeb"]].map(([label,val,color,bg]) => (
          <div key={label} className="rounded-xl p-2 text-center" style={{ backgroundColor: bg }}>
            <div className="font-black text-sm" style={{ color }}>{val}</div>
            <div className="text-[#6b6b6b] text-xs">{label}</div>
          </div>
        ))}
      </div>
    </div>,
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === i
                ? "bg-[#5b5ef4] text-white shadow-[0_4px_12px_rgba(91,94,244,0.3)]"
                : "bg-white border border-[#e5e5e5] text-[#6b6b6b] hover:border-[#5b5ef4]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="max-w-xs mx-auto shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-3xl">
        {mockups[activeTab]}
      </div>
    </div>
  );
}

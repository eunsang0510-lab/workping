"use client";

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Confirm({ message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-5">
      <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="text-[#0a0a0a] text-sm font-medium mb-5 leading-relaxed">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#f8f8f8] text-[#6b6b6b] hover:bg-[#e5e5e5] transition-all"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#5b5ef4] text-white hover:bg-[#4a4de0] transition-all"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
// BOM(﻿)이 env var에 붙는 Windows/PowerShell 문제 방어
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/^﻿/, "");

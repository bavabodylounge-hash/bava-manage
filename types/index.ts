// 프로그램 타입
export type ProgramType = 'pilatesPt' | 'bodyManage' | 'circulation' | 'headSpa';

export const PROGRAM_LABELS: Record<ProgramType, string> = {
  pilatesPt:   '필라테스PT',
  bodyManage:  '바디관리',
  circulation: '순환관리',
  headSpa:     '헤드스파',
};

export const PROGRAM_EMOJIS: Record<ProgramType, string> = {
  pilatesPt:   '🧘',
  bodyManage:  '💆',
  circulation: '🔄',
  headSpa:     '💇',
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthYear?: number;
  gender: 'female' | 'male';
  goal: string;
  personality: string;
  startDate: string;
  endDate?: string;
  trainerName: string;
  notes: string;
  status: 'active' | 'ended';
  programs?: ProgramType[];   // 등록 시 선택한 프로그램 목록
  createdAt: string;
}

// 프로그램별 사진 규칙:
//   필라테스PT  → Before 3장(앞·측·뒤) + After 3장
//   바디관리    → Before 1장 + After 1장 + 인치변화
//   순환관리    → Before 1장 + After 1장
//   헤드스파    → Before 1장 + After 1장

export interface MonthlyReport {
  id: string;
  customerId: string;
  customerName: string;
  reportMonth: string;      // YYYY-MM
  weight: number;
  height?: number;
  bodyFat?: number;
  muscleMass?: number;

  // 프로그램 정보 (복수 지원)
  programs: ReportProgram[];

  monthlyNote: string;
  personality: string;
  aiFeedback?: string;
  aiDirection?: string;
  createdAt: string;
}

export interface ReportProgram {
  programType: ProgramType;
  programLabel: string;     // 표시명
  currentSession?: number;
  remainingSessions?: number;

  // 사진 - 필라테스PT: 3장씩 / 나머지: 1장씩
  beforeFrontUrl?: string;  // 앞면 (필라테스PT Before)
  beforeSideUrl?: string;   // 측면 (필라테스PT Before)
  beforeBackUrl?: string;   // 뒷면 (필라테스PT Before)
  afterFrontUrl?: string;   // 앞면 (필라테스PT After)
  afterSideUrl?: string;    // 측면 (필라테스PT After)
  afterBackUrl?: string;    // 뒷면 (필라테스PT After)

  // 인치 변화 (바디관리 전용)
  inchLowerBefore?: number; inchLowerAfter?: number;
  inchArmBefore?: number;   inchArmAfter?: number;
  inchAbdomenBefore?: number; inchAbdomenAfter?: number;
  inchHipBefore?: number;   inchHipAfter?: number;
}

export interface FinalReport {
  id: string;
  customerId: string;
  customerName: string;
  totalMonths: number;
  startWeight: number;
  endWeight: number;
  weightChange: number;
  aiSummary?: string;
  aiRecommendation?: string;
  createdAt: string;
}

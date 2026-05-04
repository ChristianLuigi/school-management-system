export type SubjectResult = {
  subjectId: string;
  subjectCode: string;
  subjectNameI18n: Record<string, string>;
  coefficient: number;
  average: number;
};

export type ReportCardAttendanceSummary = {
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  totalRecords?: number;
  attended?: number;
  attendanceRate?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
};

export type ReportCardDetails = {
  id: string;
  batchId: string;
  school: {
    id: string;
    name: string;
    code: string;
    branding?: {
      logoUrl: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      directorName: string | null;
      reportCardTitleI18n: Record<string, string>;
      reportCardFooterI18n: Record<string, string>;
    };
  };
  gradingPeriod: {
    id: string;
    nameI18n: Record<string, string>;
  };
  section: {
    id: string;
    code: string;
    nameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
  };
  student: {
    id: string;
    code: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  averageScore: number | null;
  rankInSection: number | null;
  conductNote: string | null;
  teacherComment: string | null;
  directorComment: string | null;
  finalDecisionOverride: string | null;
  finalRemarks: string | null;
  commentsUpdatedAt: string | null;
  attendanceSummary: ReportCardAttendanceSummary;
  subjectResults: SubjectResult[];
  snapshot: Record<string, unknown>;
  batchStatus: string;
  generatedAt: string;
  publishedAt: string | null;
};

export type ReportCardLanguage = "fr" | "en";
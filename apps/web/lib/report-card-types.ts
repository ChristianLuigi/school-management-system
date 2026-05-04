export type SubjectResult = {
  subjectId: string;
  subjectCode: string;
  subjectNameI18n: Record<string, string>;
  coefficient: number;
  average: number;
};

export type ReportCardDetails = {
  id: string;
  batchId: string;
  school: {
    id: string;
    name: string;
    code: string;
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
  attendanceSummary: Record<string, unknown>;
  subjectResults: SubjectResult[];
  snapshot: Record<string, unknown>;
  batchStatus: string;
  generatedAt: string;
  publishedAt: string | null;
};

export type ReportCardLanguage = "fr" | "en";

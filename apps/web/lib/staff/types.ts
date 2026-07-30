export type EmploymentStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_LEAVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "ARCHIVED";

export type StaffCategory =
  | "SCHOOL_LEADERSHIP"
  | "TEACHING"
  | "FINANCE"
  | "ADMINISTRATIVE"
  | "STUDENT_SERVICES"
  | "SUPPORT"
  | "CONTRACTOR"
  | "OTHER";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "VOLUNTEER";

export type StaffRecord = {
  id: string;
  schoolId: string;
  userId: string | null;
  staffCode: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountryCode: string | null;
  staffCategory: StaffCategory;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  jobTitle: string | null;
  department: string | null;
  supervisorStaffAccountId: string | null;
  workLocation: string | null;
  statusEffectiveDate: string;
  statusReason: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type StaffListItem = StaffRecord & {
  account: {
    linked: boolean;
    status: string | null;
    emailVerified: boolean;
  };
  payroll: {
    hasProfile: boolean;
    active: boolean;
  };
  activeAssignmentCount: number;
};

export type StaffListResponse = {
  items: StaffListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

export type StaffOptions = {
  staffCategories: StaffCategory[];
  employmentTypes: EmploymentType[];
  employmentStatuses: EmploymentStatus[];
  departments: string[];
  supervisors: Array<{
    id: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
  }>;
};

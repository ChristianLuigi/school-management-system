import { SetMetadata } from '@nestjs/common';

export const SKIP_SCHOOL_MEMBERSHIP_KEY = 'skip_school_membership_guard';

export const SkipSchoolMembership = () =>
  SetMetadata(SKIP_SCHOOL_MEMBERSHIP_KEY, true);

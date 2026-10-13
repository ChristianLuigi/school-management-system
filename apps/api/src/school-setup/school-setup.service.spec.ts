import { BadRequestException } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';

describe('School setup eligibility', () => {
  const dto = {
    schoolId: 'school-id', academicYearNameI18n: { fr: 'Année', en: 'Year' },
    academicYearStartDate: '2027-09-01', academicYearEndDate: '2028-06-30', gradingPeriods: [],
  };
  it('rejects schools that already have an academic year without inserting data', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 'school-id', status: 'DRAFT' }] }).mockResolvedValueOnce({ rows: [{ id: 'year-id' }] });
    const db = { withTransaction: async (fn: (client: unknown) => unknown) => fn({ query }) };
    const service = new SchoolSetupService(db as never, {} as never);
    await expect(service.bootstrap(dto)).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
  it.each(['ACTIVE', 'SUSPENDED', 'ARCHIVED'])('rejects bootstrap for a %s school', async status => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 'school-id', status }] });
    const db = { withTransaction: async (fn: (client: unknown) => unknown) => fn({ query }) };
    const service = new SchoolSetupService(db as never, {} as never);
    await expect(service.bootstrap(dto)).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

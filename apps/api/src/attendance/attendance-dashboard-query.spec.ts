import { AttendanceService } from './attendance.service';

describe('Attendance dashboard query parameters', () => {
  it.each([undefined, [], ['section-a']])(
    'keeps date separate from the section scope (%j)',
    async (scope) => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const service = Object.create(
        AttendanceService.prototype,
      ) as AttendanceService;
      Object.assign(service, {
        db: { query },
        assertUserCanAccessAttendance: jest.fn().mockResolvedValue(undefined),
      });
      await service.getAttendanceDashboard(
        { schoolId: 'school-a', attendanceDate: '2026-09-13' },
        'actor',
        null,
        scope,
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          '($3::uuid[] IS NULL OR se.id = ANY($3::uuid[]))',
        ),
        ['school-a', '2026-09-13', scope ?? null],
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('sess.attendance_date = $2::date'),
        ['school-a', '2026-09-13', scope ?? null],
      );
    },
  );
});

import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import type { SubmitAttendanceSessionDto } from './dto/submit-attendance-session.dto';

describe('Attendance session locked upsert', () => {
  const dto: SubmitAttendanceSessionDto = {
    schoolId: 'school',
    sectionId: 'section',
    attendanceDate: '2026-10-07',
    slot: 'MORNING',
    records: [{ studentId: 'student', status: 'PRESENT' }],
  };

  function setup(locked: boolean) {
    const query = jest
      .fn<
        Promise<{ rows: Array<{ id?: string; student_id?: string }> }>,
        [string, unknown[]]
      >()
      .mockResolvedValueOnce({ rows: [{ id: 'section' }] })
      .mockResolvedValueOnce({ rows: [{ student_id: 'student' }] })
      .mockResolvedValueOnce({ rows: locked ? [] : [{ id: 'session' }] })
      .mockResolvedValue({ rows: [] });
    const recordTx = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(
      AttendanceService.prototype,
    ) as AttendanceService;
    Object.assign(service, {
      db: {
        withTransaction: (
          callback: (client: { query: typeof query }) => Promise<unknown>,
        ) => callback({ query }),
      },
      platformActivityService: { recordTx },
      assertUserCanAccessAttendance: jest.fn().mockResolvedValue(undefined),
    });
    return { service, query, recordTx };
  }

  it('uses an atomic locked-state condition and never writes records when blocked', async () => {
    const { service, query, recordTx } = setup(true);
    await expect(
      service.submitAttendanceSession(dto, 'actor', null),
    ).rejects.toThrow(ForbiddenException);
    expect(query.mock.calls[2][0]).toContain(
      "WHERE attendance_sessions.status IS DISTINCT FROM 'LOCKED'",
    );
    expect(query).toHaveBeenCalledTimes(3);
    expect(recordTx).not.toHaveBeenCalled();
  });

  it('continues to save and audit an unlocked session', async () => {
    const { service, query, recordTx } = setup(false);
    await expect(
      service.submitAttendanceSession(dto, 'actor', null),
    ).resolves.toMatchObject({ id: 'session' });
    expect(query.mock.calls[3][0]).toContain('INSERT INTO attendance_records');
    expect(recordTx).toHaveBeenCalledTimes(1);
  });
});

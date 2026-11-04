import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPlatformActivityDto } from './dto/list-platform-activity.dto';
import { PlatformActivityService } from './platform-activity.service';

describe('Platform activity pagination', () => {
  it('binds school/event filters, limit and offset separately with a deterministic order', async () => {
    const query = jest
      .fn<Promise<{ rows: { id: string }[] }>, [string, unknown[]?]>()
      .mockResolvedValue({ rows: [] });
    const service = new PlatformActivityService({ query } as never);
    await service.list({
      schoolId: 'school-id',
      eventType: 'SCHOOL_CREATED',
      limit: 11,
      offset: 20,
    });
    expect(query.mock.calls[0][1]).toEqual([
      'school-id',
      'SCHOOL_CREATED',
      11,
      20,
    ]);
    expect(query.mock.calls[0][0]).toContain(
      'pal.created_at DESC, pal.id DESC',
    );
    expect(query.mock.calls[0][0]).toContain('LIMIT $3');
    expect(query.mock.calls[0][0]).toContain('OFFSET $4');
  });
  it('preserves the original array response and defaults to the first page', async () => {
    const rows = [{ id: 'one' }];
    const query = jest
      .fn<Promise<{ rows: { id: string }[] }>, [string, unknown[]?]>()
      .mockResolvedValue({ rows });
    const service = new PlatformActivityService({ query } as never);
    await expect(service.list({})).resolves.toBe(rows);
    expect(query.mock.calls[0][1]).toEqual([25, 0]);
  });
  it.each([-1, 1.5, 'invalid', 2147483648])(
    'rejects invalid offset %s',
    async (offset) => {
      const dto = plainToInstance(ListPlatformActivityDto, { offset });
      expect(
        (await validate(dto)).some((error) => error.property === 'offset'),
      ).toBe(true);
    },
  );
});

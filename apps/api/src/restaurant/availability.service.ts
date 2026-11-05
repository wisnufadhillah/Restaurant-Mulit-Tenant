import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AvailabilityInput, AvailabilityRepository } from "./availability.repository";
import { calculateAvailability } from "./availability";

export function availabilityQuery(params: URLSearchParams): AvailabilityInput {
  const names = [...params.keys()].sort();
  if (names.join() !== "date,partySize,time") throw new BadRequestException();
  const date = params.get("date")!, time = params.get("time")!, party = params.get("partySize")!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !/^(?:[1-9]|1[0-2])$/.test(party)) throw new BadRequestException();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new BadRequestException();
  return { date, time, partySize: Number(party) };
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly repository: AvailabilityRepository) {}

  async check(slug: string, params: URLSearchParams) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    const input = availabilityQuery(params), now = new Date();
    try {
      const snapshot = await this.repository.snapshot(slug, input, now);
      const result = calculateAvailability(input, snapshot, now);
      const data = { startAt: result.startAt, endAt: result.endAt, timezone: result.timezone, held: result.held, available: result.available, ...(!result.available ? { reason: result.reason } : {}) };
      return { data, source: "restaurant_api", retrieved_at: now.toISOString() };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException();
    }
  }
}

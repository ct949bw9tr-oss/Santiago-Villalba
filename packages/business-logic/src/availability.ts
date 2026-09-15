import { DayOfWeek, ProviderAvailabilityException, ProviderAvailabilitySlot } from "@taskswift/types";

export interface AvailabilityCheckInput {
  slots: ProviderAvailabilitySlot[];
  exceptions: ProviderAvailabilityException[];
  /** The instant being checked, in the provider's local time. */
  when: Date;
}

/** Returns whether a provider's recurring schedule + exceptions allow booking at `when`. */
export function isProviderAvailableAt(input: AvailabilityCheckInput): boolean {
  const { slots, exceptions, when } = input;
  const dateStr = toDateString(when);
  const timeStr = toTimeString(when);
  const dayOfWeek = when.getDay() as DayOfWeek;

  const exception = exceptions.find((e) => e.date === dateStr);
  if (exception) {
    if (!exception.isAvailable) return false;
    if (exception.startTime && exception.endTime) {
      return timeStr >= exception.startTime && timeStr <= exception.endTime;
    }
    return true;
  }

  return slots.some(
    (slot) => slot.isActive && slot.dayOfWeek === dayOfWeek && timeStr >= slot.startTime && timeStr <= slot.endTime
  );
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toTimeString(date: Date): string {
  return date.toISOString().slice(11, 16);
}

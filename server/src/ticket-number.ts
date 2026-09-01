export const TICKET_NUMBER_PATTERN = /^TKT-[0-9]{4}-[0-9]{6}$/;

export function ticketNumberPrefix(createdAt: Date): string {
  return `TKT-${createdAt.getUTCFullYear()}-`;
}

export function nextTicketNumber(
  createdAt: Date,
  previousTicketNumber: string | null,
): string {
  const prefix = ticketNumberPrefix(createdAt);
  let nextSequence = 1;

  if (previousTicketNumber !== null) {
    if (!previousTicketNumber.startsWith(prefix)) {
      throw new Error("Previous Ticket Number is outside the requested UTC year");
    }
    const previousSequence = Number(previousTicketNumber.slice(prefix.length));
    if (!Number.isSafeInteger(previousSequence) || previousSequence < 1) {
      throw new Error("Previous Ticket Number has an invalid sequence");
    }
    nextSequence = previousSequence + 1;
  }

  if (nextSequence > 999999) {
    throw new Error("The yearly Ticket Number sequence is exhausted");
  }

  return `${prefix}${String(nextSequence).padStart(6, "0")}`;
}

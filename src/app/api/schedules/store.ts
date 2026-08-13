// DEPRECATED: Schedules are now stored in the database (ScheduledMessage model)
// This file is kept only for backwards compatibility.
// All schedule operations should use db.scheduledMessage

export interface ScheduledMessage {
  id: string
  eventId: string
  recipientType: string
  channel: string
  content: { text: string; mediaUrl?: string }
  templateId: string | null
  guestIds: string[]
  scheduleAt: string
  status: string
  createdAt: string
}

export function getScheduledMessages(): ScheduledMessage[] {
  return []
}

export function addSchedule(_entry: ScheduledMessage): ScheduledMessage {
  return _entry
}

export function cancelSchedule(_id: string): boolean {
  return true
}

export function getScheduleById(_id: string): ScheduledMessage | undefined {
  return undefined
}

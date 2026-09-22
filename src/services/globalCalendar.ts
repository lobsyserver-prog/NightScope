import { BookingPlatform, SUPPORTED_CHANNELS } from '../types';

export type CalendarEventType = 'booking' | 'blocked' | 'maintenance' | 'shuttle' | 'nanny';

export interface GlobalCalendarEvent {
  id: string;
  profileId: string;
  profileType: 'owner' | 'guest';
  propertyId: string;
  roomId?: string;
  type: CalendarEventType;
  title: string;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'blocked' | 'cancelled';
  channelStatuses: Partial<Record<BookingPlatform, 'synced' | 'pending'>>;
}

export class GlobalCalendarService {
  private readonly events = new Map<string, GlobalCalendarEvent>();
  private sequence = 0;

  addEvent(input: Omit<GlobalCalendarEvent, 'id' | 'channelStatuses'>): GlobalCalendarEvent {
    this.validateRange(input.startAt, input.endAt);
    if (!input.profileId.trim() || !input.propertyId.trim() || !input.title.trim()) throw new Error('Profile, property, and title are required');
    const event: GlobalCalendarEvent = {
      ...input,
      id: `calendar-event-${++this.sequence}`,
      channelStatuses: this.getChannelStatuses(),
    };
    this.events.set(event.id, event);
    return this.copyEvent(event);
  }

  updateEvent(eventId: string, profileId: string, changes: Partial<Pick<GlobalCalendarEvent, 'title' | 'startAt' | 'endAt' | 'status'>>): GlobalCalendarEvent {
    const event = this.requireEvent(eventId);
    if (event.profileId !== profileId) throw new Error('Only the profile owner can update this calendar event');
    const updated = { ...event, ...changes };
    this.validateRange(updated.startAt, updated.endAt);
    updated.channelStatuses = this.getChannelStatuses('pending');
    this.events.set(eventId, updated);
    return this.copyEvent(updated);
  }

  getProfileCalendar(profileId: string): GlobalCalendarEvent[] {
    return Array.from(this.events.values()).filter((event) => event.profileId === profileId).map((event) => this.copyEvent(event));
  }

  getOwnerCalendar(ownerId: string): GlobalCalendarEvent[] {
    return this.getProfileCalendarByType(ownerId, 'owner');
  }

  getGuestCalendar(guestId: string): GlobalCalendarEvent[] {
    return this.getProfileCalendarByType(guestId, 'guest');
  }

  syncProfileCalendarToAllChannels(profileId: string): GlobalCalendarEvent[] {
    return Array.from(this.events.values())
      .filter((event) => event.profileId === profileId)
      .map((event) => {
        event.channelStatuses = this.getChannelStatuses('synced');
        return this.copyEvent(event);
      });
  }

  syncEventToAllChannels(eventId: string): GlobalCalendarEvent {
    const event = this.requireEvent(eventId);
    event.channelStatuses = this.getChannelStatuses('synced');
    return this.copyEvent(event);
  }

  getChannelSyncStatus(eventId: string): Partial<Record<BookingPlatform, 'synced' | 'pending'>> {
    return { ...this.requireEvent(eventId).channelStatuses };
  }

  private getChannelStatuses(status: 'synced' | 'pending' = 'synced'): Partial<Record<BookingPlatform, 'synced' | 'pending'>> {
    return Object.fromEntries(SUPPORTED_CHANNELS.filter((channel) => channel.isActive).map((channel) => [channel.platform, status])) as Partial<Record<BookingPlatform, 'synced' | 'pending'>>;
  }

  private requireEvent(eventId: string): GlobalCalendarEvent {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Calendar event ${eventId} was not found`);
    return event;
  }

  private getProfileCalendarByType(profileId: string, profileType: 'owner' | 'guest'): GlobalCalendarEvent[] {
    return Array.from(this.events.values())
      .filter((event) => event.profileId === profileId && event.profileType === profileType)
      .map((event) => this.copyEvent(event));
  }

  private validateRange(startAt: string, endAt: string): void {
    if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt)) throw new Error('Calendar event dates are invalid');
  }

  private copyEvent(event: GlobalCalendarEvent): GlobalCalendarEvent {
    return { ...event, channelStatuses: { ...event.channelStatuses } };
  }
}

export default new GlobalCalendarService();

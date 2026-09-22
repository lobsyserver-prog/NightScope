import { describe, expect, it } from 'vitest';
import { AdminDirectoryService } from '../services/adminDirectory';
import { GlobalCalendarService } from '../services/globalCalendar';

describe('AdminDirectoryService', () => {
  it('builds an admin tree for profiles, properties, vehicles, and shuttles', () => {
    const service = new AdminDirectoryService();
    service.registerProfile('owner-1', 'Owner One');
    service.addProperty('owner-1', 'property-1', '117 Oxford');
    service.addVehicle('owner-1', 'property-1', 'vehicle-1', 'Toyota Quantum');
    service.addShuttle('owner-1', 'property-1', 'shuttle-1', 'Airport Shuttle', 'approved');

    const tree = service.getTree('admin');
    expect(tree[0].children[0].children.map((child) => child.type)).toEqual(['vehicle', 'shuttle']);
    expect(() => service.getTree('owner' as 'admin')).toThrow('Only admins');
  });

  it('shows and updates channel and payment gateway nodes for Admin', () => {
    const service = new AdminDirectoryService();
    service.setChannelStatus('admin', 'airbnb', 'connected');
    service.setPaymentGatewayStatus('admin', 'Paystack', 'connected');

    const nodes = service.getIntegrationNodes('admin');
    expect(nodes.find((node) => node.id === 'airbnb')?.status).toBe('connected');
    expect(nodes.find((node) => node.name === 'Paystack')?.status).toBe('connected');
  });
});

describe('GlobalCalendarService', () => {
  it('creates a profile calendar event and syncs it to every active channel', () => {
    const service = new GlobalCalendarService();
    const event = service.addEvent({ profileId: 'owner-1', profileType: 'owner', propertyId: 'property-1', roomId: 'room-1', type: 'booking', title: 'Guest booking', startAt: '2026-12-01T14:00:00Z', endAt: '2026-12-03T10:00:00Z', status: 'confirmed' });

    expect(Object.keys(event.channelStatuses)).toHaveLength(8);
    expect(service.getProfileCalendar('owner-1')).toHaveLength(1);
    expect(Object.values(service.syncEventToAllChannels(event.id).channelStatuses).every((status) => status === 'synced')).toBe(true);
  });

  it('restricts calendar updates to the profile owner', () => {
    const service = new GlobalCalendarService();
    const event = service.addEvent({ profileId: 'owner-1', profileType: 'owner', propertyId: 'property-1', type: 'blocked', title: 'Owner use', startAt: '2026-12-01', endAt: '2026-12-02', status: 'blocked' });

    expect(() => service.updateEvent(event.id, 'other-owner', { title: 'Changed' })).toThrow('Only the profile owner');
  });

  it('provides separate owner and guest calendars and syncs a profile globally', () => {
    const service = new GlobalCalendarService();
    service.addEvent({ profileId: 'owner-1', profileType: 'owner', propertyId: 'property-1', type: 'blocked', title: 'Owner use', startAt: '2026-12-01', endAt: '2026-12-02', status: 'blocked' });
    const guestEvent = service.addEvent({ profileId: 'guest-1', profileType: 'guest', propertyId: 'property-1', type: 'booking', title: 'Guest stay', startAt: '2026-12-03', endAt: '2026-12-04', status: 'confirmed' });

    expect(service.getOwnerCalendar('owner-1')).toHaveLength(1);
    expect(service.getGuestCalendar('guest-1')).toHaveLength(1);
    expect(service.syncProfileCalendarToAllChannels('guest-1')[0].id).toBe(guestEvent.id);
  });
});

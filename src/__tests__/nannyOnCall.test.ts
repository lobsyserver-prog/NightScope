import { describe, expect, it } from 'vitest';
import { NannyOnCallService, NannyProfile } from '../services/nannyOnCall';

const availableNanny: NannyProfile = {
  id: 'nanny-1',
  name: 'Amina Dlamini',
  phone: '+27000000000',
  hourlyRate: 180,
  currency: 'ZAR',
  maxChildren: 2,
  languages: ['English', ' isiXhosa'],
  backgroundChecked: true,
  firstAidCertified: true,
  availability: [{
    startAt: '2026-09-22T17:00:00Z',
    endAt: '2026-09-22T23:00:00Z',
  }],
  isActive: true,
};

describe('NannyOnCallService', () => {
  it('matches active nannies by time, capacity, language, and price', () => {
    const service = new NannyOnCallService();
    service.registerNanny(availableNanny);
    service.registerNanny({ ...availableNanny, id: 'nanny-2', name: 'Too Busy', hourlyRate: 120, maxChildren: 1 });

    const request = service.createRequest({
      propertyId: 'property-1',
      guestName: 'Guest',
      startAt: '2026-09-22T18:00:00Z',
      endAt: '2026-09-22T21:00:00Z',
      childrenCount: 2,
      childrenAges: [4, 7],
      preferredLanguage: 'English',
    });

    expect(service.findAvailableNannies(request).map((nanny) => nanny.id)).toEqual(['nanny-1']);
  });

  it('assigns and cancels a valid request', () => {
    const service = new NannyOnCallService();
    service.registerNanny(availableNanny);
    const request = service.createRequest({
      propertyId: 'property-1',
      guestName: 'Guest',
      startAt: '2026-09-22T18:00:00Z',
      endAt: '2026-09-22T21:00:00Z',
      childrenCount: 1,
      childrenAges: [5],
    });

    expect(service.assignNanny(request.id, 'nanny-1').status).toBe('assigned');
    const cancelledRequest = service.cancelRequest(request.id);
    expect(cancelledRequest.status).toBe('cancelled');
    expect(cancelledRequest).not.toHaveProperty('assignedNannyId');
  });

  it('rejects mismatched child details and invalid availability', () => {
    const service = new NannyOnCallService();

    expect(() => service.createRequest({
      propertyId: 'property-1',
      guestName: 'Guest',
      startAt: '2026-09-22T18:00:00Z',
      endAt: '2026-09-22T21:00:00Z',
      childrenCount: 2,
      childrenAges: [5],
    })).toThrow('childrenCount must match');

    expect(() => service.registerNanny({ ...availableNanny, availability: [{ startAt: '2026-09-22T21:00:00Z', endAt: '2026-09-22T18:00:00Z' }] })).toThrow('endAt must be after startAt');
  });
});

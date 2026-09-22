import { describe, expect, it } from 'vitest';
import { GuestBookingAccessService } from '../services/guestBookingAccess';
import { NannyOnCallService } from '../services/nannyOnCall';
import { ShuttleService } from '../services/shuttleService';

describe('GuestBookingAccessService', () => {
  it('provides nanny and shuttle booking links before the booking actions', () => {
    const service = new GuestBookingAccessService(new NannyOnCallService(), new ShuttleService());

    expect(service.getBookingLinks()).toEqual([
      { id: 'nanny', label: 'Book a Nanny', href: '/guest/nanny/book', actionLabel: 'Book below' },
      { id: 'shuttle', label: 'Book a Shuttle', href: '/guest/shuttle/book', actionLabel: 'Book below' },
    ]);
  });

  it('shows guests read-only active nanny profiles and approved shuttle profiles', () => {
    const nannies = new NannyOnCallService();
    const shuttles = new ShuttleService();
    const nanny = nannies.registerNanny({ id: 'nanny-1', name: 'Amina', phone: '+27000000000', hourlyRate: 180, currency: 'ZAR', maxChildren: 2, languages: ['English'], backgroundChecked: true, firstAidCertified: true, availability: [], isActive: true });
    const driver = shuttles.registerDriver({ fullName: 'Thabo', phone: '+27000000001', licenseNumber: 'LIC-1' });
    const vehicle = shuttles.registerVehicle({ driverId: driver.id, registrationNumber: 'CA 1', makeModel: 'Van', color: 'White', seats: 8, wheelchairAccessible: true });
    shuttles.approveDriver(driver.id);
    shuttles.approveVehicle(vehicle.id);
    const service = new GuestBookingAccessService(nannies, shuttles);

    const visibleNannies = service.getNannyProfiles();
    const visibleShuttles = service.getShuttleProfiles();
    visibleNannies[0].languages.push('Changed locally');
    visibleShuttles[0].vehicles[0].seats = 1;

    expect(visibleNannies).toHaveLength(1);
    expect(nannies.getPublicProfiles()[0].languages).toEqual(['English']);
    expect(visibleShuttles).toHaveLength(1);
    expect(shuttles.getPublicProfiles()[0].vehicles[0].seats).toBe(8);
  });
});

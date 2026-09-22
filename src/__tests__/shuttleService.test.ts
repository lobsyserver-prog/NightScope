import { describe, expect, it } from 'vitest';
import { ShuttleService } from '../services/shuttleService';

describe('ShuttleService', () => {
  it('registers a driver and vehicle through approval', () => {
    const service = new ShuttleService();
    const driver = service.registerDriver({
      fullName: 'Thabo Mokoena',
      phone: '+27000000000',
      licenseNumber: 'LIC-123',
    });
    const vehicle = service.registerVehicle({
      driverId: driver.id,
      registrationNumber: 'CA 123-456',
      makeModel: 'Toyota Quantum',
      color: 'White',
      seats: 10,
      wheelchairAccessible: true,
    });

    expect(driver.status).toBe('pending');
    expect(vehicle.status).toBe('pending');
    expect(service.approveDriver(driver.id).status).toBe('approved');
    expect(service.approveVehicle(vehicle.id).status).toBe('approved');
  });

  it('matches approved vehicles by passenger capacity and accessibility', () => {
    const service = new ShuttleService();
    const driver = service.registerDriver({ fullName: 'Driver', phone: '000', licenseNumber: 'LIC-1' });
    const vehicle = service.registerVehicle({
      driverId: driver.id,
      registrationNumber: 'REG-1',
      makeModel: 'Van',
      color: 'Blue',
      seats: 8,
      wheelchairAccessible: true,
    });
    service.approveDriver(driver.id);
    service.approveVehicle(vehicle.id);
    const request = service.createRequest({
      guestId: 'guest-1',
      pickup: 'Cape Town Airport',
      dropoff: 'NightScope Villa',
      pickupAt: '2026-09-25T14:00:00Z',
      passengerCount: 4,
      wheelchairRequired: true,
    });

    expect(service.findAvailableDrivers(request)).toHaveLength(1);
    expect(service.assignDriver(request.id, driver.id).vehicleId).toBe(vehicle.id);
  });

  it('rejects duplicate registrations and invalid shuttle requests', () => {
    const service = new ShuttleService();
    const driver = service.registerDriver({ fullName: 'Driver', phone: '000', licenseNumber: 'LIC-1' });

    expect(() => service.registerDriver({ fullName: 'Another Driver', phone: '111', licenseNumber: 'LIC-1' })).toThrow('already registered');
    expect(() => service.registerVehicle({
      driverId: driver.id,
      registrationNumber: 'REG-1',
      makeModel: 'Van',
      color: 'White',
      seats: 0,
      wheelchairAccessible: false,
    })).toThrow('positive seat count');
    expect(() => service.createRequest({
      guestId: 'guest-1',
      pickup: 'Airport',
      dropoff: 'Hotel',
      pickupAt: 'invalid-date',
      passengerCount: 1,
      wheelchairRequired: false,
    })).toThrow('valid date');
  });
});

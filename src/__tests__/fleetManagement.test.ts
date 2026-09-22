import { describe, expect, it } from 'vitest';
import { FleetManagementService } from '../services/fleetManagement';

describe('FleetManagementService', () => {
  it('lets an owner register a vehicle for admin approval', () => {
    const service = new FleetManagementService();
    const vehicle = service.registerVehicle({
      ownerId: 'owner-1',
      registrationNumber: 'CA 123-456',
      makeModel: 'Toyota Quantum',
      vin: 'VIN-123',
      seats: 10,
      licenseDiskExpiresAt: '2026-12-31',
    });

    expect(vehicle.status).toBe('pending');
    expect(service.getOwnerVehicles('owner-1')).toHaveLength(1);
    expect(() => service.approveVehicle('owner', vehicle.id)).toThrow('Only admins');
  });

  it('lets Admin approve vehicles, renew license disks, and check expiry', () => {
    const service = new FleetManagementService();
    const vehicle = service.registerVehicle({
      ownerId: 'owner-1', registrationNumber: 'CA 1', makeModel: 'Van', vin: 'VIN-1', seats: 8, licenseDiskExpiresAt: '2025-01-01',
    });

    service.approveVehicle('admin', vehicle.id);
    expect(service.getComplianceSummary(vehicle.id, new Date('2026-01-01'))).toMatchObject({ status: 'approved', licenseDiskExpired: true });
    service.renewLicenseDisk('admin', vehicle.id, '2027-01-01', 50000, 'renewal-payment-1');
    expect(service.getComplianceSummary(vehicle.id, new Date('2026-01-01')).licenseDiskExpired).toBe(false);
  });

  it('tracks, pays, and reports vehicle fines', () => {
    const service = new FleetManagementService();
    const vehicle = service.registerVehicle({
      ownerId: 'owner-1', registrationNumber: 'CA 2', makeModel: 'Sedan', vin: 'VIN-2', seats: 4, licenseDiskExpiresAt: '2027-01-01',
    });
    const fine = service.issueFine('admin', vehicle.id, 75000, 'Speeding fine', '2026-11-01');

    expect(service.getComplianceSummary(vehicle.id).unpaidFinesMinor).toBe(75000);
    expect(() => service.payFine('owner', fine.id, 'owner-payment-1')).toThrow('Only admins');
    service.payFine('admin', fine.id, 'admin-payment-1');
    expect(service.getComplianceSummary(vehicle.id).unpaidFines).toBe(0);
  });

  it('prevents duplicate vehicles and invalid compliance records', () => {
    const service = new FleetManagementService();
    service.registerVehicle({
      ownerId: 'owner-1', registrationNumber: 'CA 3', makeModel: 'Car', vin: 'VIN-3', seats: 4, licenseDiskExpiresAt: '2027-01-01',
    });

    expect(() => service.registerVehicle({
      ownerId: 'owner-2', registrationNumber: 'CA 3', makeModel: 'Car', vin: 'VIN-4', seats: 4, licenseDiskExpiresAt: '2027-01-01',
    })).toThrow('already registered');
    expect(() => service.issueFine('admin', 'missing', 1000, 'Fine', '2026-11-01')).toThrow('was not found');
  });
});

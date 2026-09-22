import { describe, expect, it } from 'vitest';
import { KioskManagementService } from '../services/kioskManagement';

describe('KioskManagementService', () => {
  it('requires an active registered owner before kiosk activation', () => {
    const service = new KioskManagementService();

    service.registerOwner('owner-1', 'property-1');
    expect(() => service.registerKiosk('owner-1')).toThrow('Owner must be active');
    service.activateOwner('owner-1');
    const kiosk = service.registerKiosk('owner-1', 'Villa Kiosk');

    expect(kiosk.status).toBe('draft');
    expect(service.activateKiosk('owner-1', kiosk.id).status).toBe('active');
  });

  it('lets an active owner share the active kiosk with staff', () => {
    const service = new KioskManagementService();
    service.registerOwner('owner-1', 'property-1');
    service.activateOwner('owner-1');
    const kiosk = service.registerKiosk('owner-1');
    service.activateKiosk('owner-1', kiosk.id);

    const access = service.shareWithStaff('owner-1', kiosk.id, 'staff-1', 'staff@example.com');

    expect(access).toMatchObject({ kioskId: kiosk.id, staffId: 'staff-1', status: 'active' });
    expect(access.accessToken).toBeTruthy();
    expect(service.getStaffAccess(kiosk.id)).toHaveLength(1);
  });

  it('prevents unauthorized sharing and supports revocation', () => {
    const service = new KioskManagementService();
    service.registerOwner('owner-1', 'property-1');
    service.activateOwner('owner-1');
    const kiosk = service.registerKiosk('owner-1');
    service.activateKiosk('owner-1', kiosk.id);

    expect(() => service.shareWithStaff('other-owner', kiosk.id, 'staff-1')).toThrow('Only the kiosk owner');
    const access = service.shareWithStaff('owner-1', kiosk.id, 'staff-1');
    expect(service.revokeStaffAccess('owner-1', access.id).status).toBe('revoked');
  });
});

import { describe, expect, it } from 'vitest';
import { StaffPortalService } from '../services/staffPortal';

describe('StaffPortalService', () => {
  it('creates a QR check-in code and validates guest check-in', () => {
    const service = new StaffPortalService();
    const qr = service.createCheckInQr('owner', 'property-1', '2026-12-31T23:59:59Z');

    expect(qr.qrCodeUrl).toContain('quickchart.io/qr');
    expect(service.checkInWithQr(qr.token, 'guest-1', new Date('2026-10-01'))).toMatchObject({ guestId: 'guest-1', propertyId: 'property-1' });
    service.revokeCheckInQr('owner', qr.id);
    expect(() => service.checkInWithQr(qr.token, 'guest-1', new Date('2026-10-01'))).toThrow('invalid or revoked');
  });

  it('supports owner HR/payroll actions and staff payslip access', () => {
    const service = new StaffPortalService();
    service.registerStaff('owner-1', { id: 'staff-1', fullName: 'Staff Member', email: 'staff@example.com' });
    const payslip = service.addPayslip('owner', { staffId: 'staff-1', payPeriod: '2026-09', grossMinor: 200000, deductionsMinor: 30000, netMinor: 170000, currency: 'zar' });

    expect(payslip.currency).toBe('ZAR');
    expect(service.getStaffPayslips('staff-1')).toHaveLength(1);
    expect(() => service.addPayslip('owner', { staffId: 'staff-1', payPeriod: '2026-10', grossMinor: 100, deductionsMinor: 20, netMinor: 90, currency: 'ZAR' })).toThrow('invalid');
  });

  it('lets staff request leave and management decide it', () => {
    const service = new StaffPortalService();
    service.registerStaff('owner-1', { id: 'staff-1', fullName: 'Staff Member', email: 'staff@example.com' });
    const leave = service.requestLeave('staff-1', '2026-11-01', '2026-11-03', 'Family leave');

    expect(service.decideLeave('owner', leave.id, true).status).toBe('approved');
  });

  it('provides wellness programs for staff enrollment', () => {
    const service = new StaffPortalService();
    service.registerStaff('owner-1', { id: 'staff-1', fullName: 'Staff Member', email: 'staff@example.com' });
    service.addWellnessProgram('admin', { id: 'wellness-1', name: 'Mindfulness', description: 'Weekly wellness sessions', isActive: true });

    expect(service.getWellnessPrograms()).toHaveLength(1);
    expect(() => service.enrollInWellness('staff-1', 'wellness-1')).not.toThrow();
  });
});

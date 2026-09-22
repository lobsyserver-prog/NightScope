import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OwnerManagementService } from '../services/ownerManagement';
import { JsonFileStore } from '../services/persistence';

describe('OwnerManagementService', () => {
  it('provides owner menu and dynamic pricing', () => {
    const service = new OwnerManagementService();
    expect(service.getOwnerMenu()).toHaveLength(13);
    expect(service.calculateDynamicPrice(100000, '2026-09-26', false, 0)).toBe(115000);
    expect(service.calculateDynamicPrice(100000, '2026-09-26', true, 80)).toBe(160000);
  });

  it('tracks payouts, add-ons, and blocks owner-use dates', () => {
    const service = new OwnerManagementService();
    service.recordPayout({ propertyId: 'property-1', bookingId: 'booking-1', amountMinor: 150000, currency: 'ZAR', status: 'paid' });
    service.recordPayout({ propertyId: 'property-1', bookingId: 'booking-2', amountMinor: 50000, currency: 'ZAR', status: 'pending' });
    expect(service.getPayoutDashboard('property-1')).toMatchObject({ paidMinor: 150000, pendingMinor: 50000 });
    expect(service.addAddOn({ name: 'Breakfast', priceMinor: 15000, currency: 'zar' }).currency).toBe('ZAR');
    service.blockDates('property-1', '2026-10-01', '2026-10-04');
    expect(service.isAvailable('property-1', '2026-10-04', '2026-10-05')).toBe(true);
    expect(service.isAvailable('property-1', '2026-10-02', '2026-10-03')).toBe(false);
  });

  it('creates operations messages, cleaning tasks, and access codes', () => {
    const service = new OwnerManagementService();
    const task = service.createCleaningTask('property-1', 'room-1', '2026-10-04T10:00:00Z', 'cleaner-1');
    const code = service.generateAccessCode();

    expect(task.status).toBe('assigned');
    expect(code).toMatch(/^\d{6}$/);
    expect(service.getWhatsAppMessageUrl('+27 71 234 5678', 'WiFi: NightScope')).toContain('https://wa.me/27712345678');
  });

  it('protects guests, manages reviews, analytics, promotions, and properties', () => {
    const service = new OwnerManagementService();
    expect(service.verifyGuestAndRecordDeposit('guest-1', true, 50000).verified).toBe(true);
    const review = service.requestReview({ propertyId: 'property-1', guestId: 'guest-1', rating: 5, comment: 'Excellent stay' });
    expect(service.replyToReview(review.id, 'Thank you').response).toBe('Thank you');
    service.recordBookingAnalytics({ propertyId: 'property-1', month: '2026-09', platform: 'direct', revenueMinor: 200000, nights: 10 });
    expect(service.getAnalytics('property-1')).toMatchObject({ revenueMinor: 200000, bestPlatform: 'direct' });
    service.createPromoCode('FERNDALE10', 10);
    expect(service.getPromoDiscount('ferndale10')).toBe(10);
    expect(service.addProperty({ id: 'property-1', ownerId: 'owner-1', name: 'Villa', address: '117 Oxford' })).toHaveLength(1);
  });

  it('persists reporting analytics across service instances', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nightscope-reporting-'));
    const filePath = join(directory, 'reporting.json');

    try {
      const firstService = new OwnerManagementService(new JsonFileStore(filePath));
      await firstService.initialize();
      firstService.recordBookingAnalytics({ propertyId: 'property-1', month: '2026-09', platform: 'direct', revenueMinor: 250000, nights: 12 });
      await firstService.flush();

      const secondService = new OwnerManagementService(new JsonFileStore(filePath));
      await secondService.initialize();
      expect(secondService.getAnalytics('property-1')).toMatchObject({ revenueMinor: 250000, bestPlatform: 'direct' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from 'vitest';
import { BookingChannelsService } from '../services/bookingChannels';
import { PaymentGatewayService } from '../services/paymentGateways';

describe('BookingChannelsService', () => {
  it('initializes direct booking channel without API credentials', async () => {
    const service = new BookingChannelsService();

    await service.initializeChannel({
      id: 'direct-1',
      platform: 'direct',
      name: 'Direct Bookings',
      isActive: true,
      apiKey: '',
      accountId: '',
      lastSyncedAt: null,
      syncStatus: 'idle',
    });

    expect(service.getChannelByPlatform('direct')?.id).toBe('direct');
    expect(service.getChannelByPlatform('direct')?.isActive).toBe(true);
  });

  it('registers all supported channels as active', () => {
    const service = new BookingChannelsService();
    const channels = service.getSupportedChannels();

    expect(channels).toHaveLength(8);
    expect(channels.map(c => c.platform)).toEqual([
      'airbnb',
      'booking.com',
      'lekkeslaap',
      'expedia',
      'vrbo',
      'trivago',
      'tripadvisor',
      'direct',
    ]);
    expect(channels.every(c => c.isActive)).toBe(true);
  });
});

describe('PaymentGatewayService', () => {
  it('exposes all payment gateways as active', () => {
    const service = new PaymentGatewayService();
    const gateways = service.getActiveGateways();

    expect(gateways.map(g => g.name)).toEqual([
      'Stripe',
      'Yoco',
      'PayFast',
      'Ozow',
      'Paystack',
      'Pay at property',
    ]);
    expect(gateways.every(g => g.isActive)).toBe(true);
  });
});

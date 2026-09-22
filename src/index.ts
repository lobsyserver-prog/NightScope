import { BookingChannelsService } from './services/bookingChannels';

const service = new BookingChannelsService();

await service.initializeChannel({
  id: 'direct-demo',
  platform: 'direct',
  name: 'Direct Bookings',
  isActive: true,
  apiKey: '',
  accountId: '',
  lastSyncedAt: null,
  syncStatus: 'idle',
});

console.log('ScopeBridge booking service initialized');

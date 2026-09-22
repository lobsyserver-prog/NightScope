export type BookingPlatform =
  | 'airbnb'
  | 'booking.com'
  | 'lekkeslaap'
  | 'expedia'
  | 'vrbo'
  | 'trivago'
  | 'tripadvisor'
  | 'direct';

export const SUPPORTED_CHANNELS: ReadonlyArray<{ platform: BookingPlatform; name: string; isActive: boolean }> = [
  { platform: 'airbnb', name: 'Airbnb', isActive: true },
  { platform: 'booking.com', name: 'Booking.com', isActive: true },
  { platform: 'lekkeslaap', name: 'Lekkeslaap', isActive: true },
  { platform: 'expedia', name: 'Expedia', isActive: true },
  { platform: 'vrbo', name: 'VRBO', isActive: true },
  { platform: 'trivago', name: 'Trivago', isActive: true },
  { platform: 'tripadvisor', name: 'TripAdvisor', isActive: true },
  { platform: 'direct', name: 'Direct', isActive: true },
];

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export interface BookingChannel {
  id: string;
  platform: BookingPlatform;
  name: string;
  isActive: boolean;
  apiKey: string;
  accountId: string;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'synced' | 'failed';
}

export interface UnifiedBooking {
  id: string;
  externalIds: Record<string, string | number>;
  propertyId: string;
  propertyName: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  platform: BookingPlatform;
  paymentStatus: 'pending' | 'completed' | 'refunded';
  notes: string;
  specialRequests: string;
  cancellationPolicy: string;
  communicationLog: unknown[];
  createdAt: string;
  updatedAt: string;
  lastSyncedFrom: string;
}

export interface SyncError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ChannelSyncResponse {
  channelId: string;
  platform: BookingPlatform;
  status: 'success' | 'partial' | 'failed';
  bookingsRetrieved: number;
  bookingsCreated: number;
  bookingsUpdated: number;
  bookingsSkipped: number;
  calendarEventsCreated: number;
  calendarEventsUpdated: number;
  errors: SyncError[];
  startTime: string;
  endTime: string;
  duration: number;
}

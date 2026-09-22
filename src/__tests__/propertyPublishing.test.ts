import { describe, expect, it } from 'vitest';
import { PropertyPublishingService, RoomPricing } from '../services/propertyPublishing';

const pricing: RoomPricing = {
  minimumRateMinor: 100000,
  baseRateMinor: 150000,
  maximumRateMinor: 250000,
  currency: 'zar',
};

function createService(): PropertyPublishingService {
  const service = new PropertyPublishingService();
  service.registerProperty({
    id: 'property-1',
    ownerId: 'owner-1',
    name: 'NightScope Villa',
    address: 'Cape Town',
    rooms: [
      { id: 'room-1', name: 'Ocean Room', pricing, publishedChannels: [] },
      { id: 'room-2', name: 'Garden Room', pricing: { ...pricing, baseRateMinor: 180000 }, publishedChannels: [] },
    ],
  });
  return service;
}

describe('PropertyPublishingService', () => {
  it('publishes a property to every supported active channel', () => {
    const service = createService();
    const property = service.publishPropertyToAllChannels('owner-1', 'property-1');

    expect(property.publishedChannels).toEqual([
      'airbnb', 'booking.com', 'lekkeslaap', 'expedia', 'vrbo', 'trivago', 'tripadvisor', 'direct',
    ]);
  });

  it('publishes an individual room only to the owner-selected channel', () => {
    const service = createService();
    const room = service.publishRoomToChannel('owner-1', 'property-1', 'room-1', 'airbnb');

    expect(room.publishedChannels).toEqual(['airbnb']);
    expect(service.getProperty('property-1')?.rooms[1].publishedChannels).toEqual([]);
  });

  it('allows the owner to edit room price ranges', () => {
    const service = createService();
    const updatedRoom = service.updateRoomPricing('owner-1', 'property-1', 'room-1', {
      minimumRateMinor: 120000,
      baseRateMinor: 175000,
      maximumRateMinor: 300000,
      currency: 'zar',
    });

    expect(updatedRoom.pricing).toEqual({
      minimumRateMinor: 120000,
      baseRateMinor: 175000,
      maximumRateMinor: 300000,
      currency: 'ZAR',
    });
  });

  it('blocks unauthorized edits and invalid price ranges', () => {
    const service = createService();

    expect(() => service.publishPropertyToAllChannels('other-owner', 'property-1')).toThrow('Only the property owner');
    expect(() => service.updateRoomPricing('owner-1', 'property-1', 'room-1', {
      minimumRateMinor: 200000,
      baseRateMinor: 100000,
      maximumRateMinor: 300000,
      currency: 'ZAR',
    })).toThrow('minimum <= base <= maximum');
  });
});

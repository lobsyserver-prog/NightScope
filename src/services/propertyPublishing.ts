import { BookingPlatform, SUPPORTED_CHANNELS } from '../types';

export interface RoomPricing {
  minimumRateMinor: number;
  baseRateMinor: number;
  maximumRateMinor: number;
  currency: string;
}

export interface PropertyRoom {
  id: string;
  name: string;
  pricing: RoomPricing;
  publishedChannels: BookingPlatform[];
}

export interface PropertyListing {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  rooms: PropertyRoom[];
  publishedChannels: BookingPlatform[];
}

export class PropertyPublishingService {
  private readonly properties = new Map<string, PropertyListing>();

  registerProperty(
    input: Omit<PropertyListing, 'publishedChannels'>
  ): PropertyListing {
    if (!input.ownerId.trim() || !input.name.trim() || !input.address.trim()) {
      throw new Error('Owner, property name, and address are required');
    }
    if (this.properties.has(input.id)) {
      throw new Error(`Property ${input.id} is already registered`);
    }
    input.rooms.forEach((room) => this.validatePricing(room.pricing));

    const property: PropertyListing = {
      ...input,
      publishedChannels: [],
      rooms: input.rooms.map((room) => ({ ...room, publishedChannels: [] })),
    };
    this.properties.set(property.id, property);
    return property;
  }

  publishPropertyToAllChannels(ownerId: string, propertyId: string): PropertyListing {
    const property = this.requireOwner(propertyId, ownerId);
    property.publishedChannels = this.activePlatforms();
    return property;
  }

  publishPropertyToChannels(
    ownerId: string,
    propertyId: string,
    platforms: BookingPlatform[]
  ): PropertyListing {
    const property = this.requireOwner(propertyId, ownerId);
    this.validatePlatforms(platforms);
    property.publishedChannels = Array.from(new Set(platforms));
    return property;
  }

  publishRoomToChannel(
    ownerId: string,
    propertyId: string,
    roomId: string,
    platform: BookingPlatform
  ): PropertyRoom {
    const property = this.requireOwner(propertyId, ownerId);
    this.validatePlatforms([platform]);
    const room = this.requireRoom(property, roomId);
    if (!room.publishedChannels.includes(platform)) room.publishedChannels.push(platform);
    return room;
  }

  updateRoomPricing(
    ownerId: string,
    propertyId: string,
    roomId: string,
    pricing: RoomPricing
  ): PropertyRoom {
    const property = this.requireOwner(propertyId, ownerId);
    this.validatePricing(pricing);
    const room = this.requireRoom(property, roomId);
    room.pricing = { ...pricing, currency: pricing.currency.toUpperCase() };
    return room;
  }

  getProperty(propertyId: string): PropertyListing | undefined {
    return this.properties.get(propertyId);
  }

  private activePlatforms(): BookingPlatform[] {
    return SUPPORTED_CHANNELS.filter((channel) => channel.isActive).map((channel) => channel.platform);
  }

  private validatePlatforms(platforms: BookingPlatform[]): void {
    const supportedPlatforms = new Set(SUPPORTED_CHANNELS.map((channel) => channel.platform));
    if (platforms.some((platform) => !supportedPlatforms.has(platform))) {
      throw new Error('One or more selected channels are not supported');
    }
  }

  private validatePricing(pricing: RoomPricing): void {
    if (!pricing.currency.trim()
      || !Number.isSafeInteger(pricing.minimumRateMinor)
      || !Number.isSafeInteger(pricing.baseRateMinor)
      || !Number.isSafeInteger(pricing.maximumRateMinor)
      || pricing.minimumRateMinor <= 0
      || pricing.minimumRateMinor > pricing.baseRateMinor
      || pricing.baseRateMinor > pricing.maximumRateMinor) {
      throw new Error('Room pricing must be positive integers with minimum <= base <= maximum');
    }
  }

  private requireOwner(propertyId: string, ownerId: string): PropertyListing {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} was not found`);
    if (property.ownerId !== ownerId) throw new Error('Only the property owner can change publication or pricing');
    return property;
  }

  private requireRoom(property: PropertyListing, roomId: string): PropertyRoom {
    const room = property.rooms.find((candidate) => candidate.id === roomId);
    if (!room) throw new Error(`Room ${roomId} was not found`);
    return room;
  }
}

export default new PropertyPublishingService();

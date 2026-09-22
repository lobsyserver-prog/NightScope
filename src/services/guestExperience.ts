import paymentGatewayService, { PaymentGatewayName } from './paymentGateways';

export const GUEST_MENU_OPTIONS = [
  'Wishlist / Save',
  'Map View + Distance',
  'Chat with Host / WhatsApp',
  'Reviews & Guest Photos',
  'Flexible Filters',
  'Easy Pay',
  'Itinerary / Trip Tools',
  'Loyalty / Repeat Guest Discount',
] as const;

export interface GuestListing {
  id: string;
  name: string;
  priceMinor: number;
  latitude: number;
  longitude: number;
  amenities: string[];
  selfCheckIn: boolean;
  parking: boolean;
  wifi: boolean;
  kitchen: boolean;
  petFriendly: boolean;
  familyFriendly: boolean;
}

export interface GuestSearchFilters {
  minPriceMinor?: number;
  maxPriceMinor?: number;
  amenities?: string[];
  selfCheckIn?: boolean;
  parking?: boolean;
  wifi?: boolean;
  kitchen?: boolean;
  petFriendly?: boolean;
  familyFriendly?: boolean;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
}

export interface GuestReview {
  id: string;
  propertyId: string;
  guestId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  photoUrls: string[];
  createdAt: string;
}

export interface HostChatMessage {
  id: string;
  guestId: string;
  hostId: string;
  message: string;
  createdAt: string;
}

export interface ItineraryDetails {
  checkInInstructions: string;
  directionsUrl: string;
  localTips: string[];
}

export class GuestExperienceService {
  private readonly wishlists = new Map<string, Set<string>>();
  private readonly reviews: GuestReview[] = [];
  private readonly chatMessages: HostChatMessage[] = [];
  private readonly completedBookings = new Map<string, number>();
  private sequence = 0;

  getGuestMenu(): readonly string[] {
    return GUEST_MENU_OPTIONS;
  }

  saveToWishlist(guestId: string, propertyId: string): string[] {
    const wishlist = this.wishlists.get(guestId) ?? new Set<string>();
    wishlist.add(propertyId);
    this.wishlists.set(guestId, wishlist);
    return Array.from(wishlist);
  }

  removeFromWishlist(guestId: string, propertyId: string): string[] {
    const wishlist = this.wishlists.get(guestId) ?? new Set<string>();
    wishlist.delete(propertyId);
    this.wishlists.set(guestId, wishlist);
    return Array.from(wishlist);
  }

  getWishlist(guestId: string): string[] {
    return Array.from(this.wishlists.get(guestId) ?? []);
  }

  filterListings(listings: GuestListing[], filters: GuestSearchFilters): GuestListing[] {
    return listings.filter((listing) => {
      if (filters.minPriceMinor !== undefined && listing.priceMinor < filters.minPriceMinor) return false;
      if (filters.maxPriceMinor !== undefined && listing.priceMinor > filters.maxPriceMinor) return false;
      if (filters.amenities?.some((amenity) => !listing.amenities.includes(amenity))) return false;
      if (filters.selfCheckIn !== undefined && listing.selfCheckIn !== filters.selfCheckIn) return false;
      if (filters.parking !== undefined && listing.parking !== filters.parking) return false;
      if (filters.wifi !== undefined && listing.wifi !== filters.wifi) return false;
      if (filters.kitchen !== undefined && listing.kitchen !== filters.kitchen) return false;
      if (filters.petFriendly !== undefined && listing.petFriendly !== filters.petFriendly) return false;
      if (filters.familyFriendly !== undefined && listing.familyFriendly !== filters.familyFriendly) return false;
      if (filters.latitude !== undefined && filters.longitude !== undefined && filters.maxDistanceKm !== undefined
        && this.distanceKm(filters.latitude, filters.longitude, listing.latitude, listing.longitude) > filters.maxDistanceKm) return false;
      return true;
    });
  }

  getDistanceKm(fromLatitude: number, fromLongitude: number, listing: GuestListing): number {
    return this.distanceKm(fromLatitude, fromLongitude, listing.latitude, listing.longitude);
  }

  addReview(input: Omit<GuestReview, 'id' | 'createdAt'>): GuestReview {
    if (!input.comment.trim() || input.rating < 1 || input.rating > 5) throw new Error('Review comment and rating from 1 to 5 are required');
    const review: GuestReview = { ...input, id: `review-${++this.sequence}`, createdAt: new Date().toISOString() };
    this.reviews.push(review);
    return review;
  }

  getReviews(propertyId: string): GuestReview[] {
    return this.reviews.filter((review) => review.propertyId === propertyId).map((review) => ({ ...review, photoUrls: [...review.photoUrls] }));
  }

  sendHostMessage(guestId: string, hostId: string, message: string): HostChatMessage {
    if (!guestId.trim() || !hostId.trim() || !message.trim()) throw new Error('Guest, host, and message are required');
    const chatMessage = { id: `chat-${++this.sequence}`, guestId, hostId, message, createdAt: new Date().toISOString() };
    this.chatMessages.push(chatMessage);
    return chatMessage;
  }

  getWhatsAppUrl(registeredPhoneNumber: string, message = ''): string {
    const phone = registeredPhoneNumber.replace(/[^0-9]/g, '');
    if (!phone) throw new Error('A registered phone number is required for WhatsApp');
    return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  }

  getPaymentOptions(): PaymentGatewayName[] {
    return paymentGatewayService.getActiveGateways().map((gateway) => gateway.name);
  }

  buildItinerary(details: ItineraryDetails): ItineraryDetails {
    if (!details.checkInInstructions.trim() || !details.directionsUrl.trim()) throw new Error('Check-in instructions and directions are required');
    return { ...details, localTips: [...details.localTips] };
  }

  recordCompletedBooking(guestId: string): number {
    const count = (this.completedBookings.get(guestId) ?? 0) + 1;
    this.completedBookings.set(guestId, count);
    return count;
  }

  getRepeatGuestDiscountPercent(guestId: string): number {
    return (this.completedBookings.get(guestId) ?? 0) > 0 ? 10 : 0;
  }

  private distanceKm(firstLatitude: number, firstLongitude: number, secondLatitude: number, secondLongitude: number): number {
    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(secondLatitude - firstLatitude);
    const longitudeDelta = this.toRadians(secondLongitude - firstLongitude);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(this.toRadians(firstLatitude)) * Math.cos(this.toRadians(secondLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }
}

export default new GuestExperienceService();

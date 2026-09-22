import { describe, expect, it } from 'vitest';
import { GuestExperienceService } from '../services/guestExperience';

describe('GuestExperienceService', () => {
  it('provides the complete guest menu and manages wishlist saves', () => {
    const service = new GuestExperienceService();

    expect(service.getGuestMenu()).toHaveLength(8);
    expect(service.saveToWishlist('guest-1', 'property-1')).toEqual(['property-1']);
    expect(service.removeFromWishlist('guest-1', 'property-1')).toEqual([]);
  });

  it('filters by price, amenities, and map distance', () => {
    const service = new GuestExperienceService();
    const listings = [
      { id: 'nearby', name: 'Nearby', priceMinor: 100000, latitude: -26.0899, longitude: 28.001, amenities: ['wifi', 'parking'], selfCheckIn: true, parking: true, wifi: true, kitchen: false, petFriendly: false, familyFriendly: true },
      { id: 'far', name: 'Far', priceMinor: 100000, latitude: -33.9249, longitude: 18.4241, amenities: ['wifi'], selfCheckIn: false, parking: false, wifi: true, kitchen: true, petFriendly: true, familyFriendly: false },
    ];

    expect(service.filterListings(listings, { parking: true, wifi: true, familyFriendly: true, latitude: -26.09, longitude: 28, maxDistanceKm: 5 }).map((listing) => listing.id)).toEqual(['nearby']);
    expect(service.getDistanceKm(-26.09, 28, listings[0])).toBeLessThan(1);
  });

  it('supports guest reviews, host chat, and WhatsApp from the registered phone', () => {
    const service = new GuestExperienceService();
    service.addReview({ propertyId: 'property-1', guestId: 'guest-1', rating: 5, comment: 'Great stay', photoUrls: ['https://example.com/photo.jpg'] });

    expect(service.getReviews('property-1')[0].photoUrls).toEqual(['https://example.com/photo.jpg']);
    expect(service.sendHostMessage('guest-1', 'host-1', 'Can I check in early?').message).toContain('early');
    expect(service.getWhatsAppUrl('+27 71 234 5678', 'Hello host')).toBe('https://wa.me/27712345678?text=Hello%20host');
  });

  it('exposes easy payment, itinerary, and loyalty tools', () => {
    const service = new GuestExperienceService();

    expect(service.getPaymentOptions()).toEqual(['Stripe', 'Yoco', 'PayFast', 'Ozow', 'Paystack', 'Pay at property']);
    expect(service.buildItinerary({ checkInInstructions: 'Use the lockbox', directionsUrl: 'https://maps.google.com', localTips: ['Ferndale restaurants', 'Nearest Spar'] }).localTips).toHaveLength(2);
    expect(service.getRepeatGuestDiscountPercent('guest-1')).toBe(0);
    service.recordCompletedBooking('guest-1');
    expect(service.getRepeatGuestDiscountPercent('guest-1')).toBe(10);
  });
});

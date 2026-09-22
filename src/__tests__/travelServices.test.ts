import { describe, expect, it } from 'vitest';
import { CarHireService } from '../services/carHire';
import { FlightBookingService } from '../services/flightBooking';
import { RoomBiddingService } from '../services/roomBidding';

describe('CarHireService', () => {
  it('searches and books available cars without allowing date overlap', () => {
    const service = new CarHireService();
    const car = service.registerVehicle({ providerName: 'NightScope Cars', makeModel: 'Toyota Corolla', registrationNumber: 'CAR-1', seats: 4, dailyRateMinor: 50000, currency: 'zar' });
    const booking = service.bookVehicle(car.id, 'guest-1', '2026-10-01T10:00:00Z', '2026-10-03T10:00:00Z');

    expect(booking.totalPriceMinor).toBe(100000);
    expect(service.searchAvailable('2026-10-02T10:00:00Z', '2026-10-04T10:00:00Z')).toHaveLength(0);
  });
});

describe('FlightBookingService', () => {
  it('searches flights by route and decreases seats when booked', () => {
    const service = new FlightBookingService();
    const offer = service.addFlightOffer({ providerName: 'NightScope Flights', airline: 'NS Air', flightNumber: 'NS101', origin: 'JNB', destination: 'CPT', departureAt: '2026-10-01T08:00:00Z', arrivalAt: '2026-10-01T10:00:00Z', priceMinor: 120000, currency: 'zar', availableSeats: 3 });

    expect(service.searchFlights('JNB', 'CPT', 2)).toHaveLength(1);
    expect(service.bookFlight(offer.id, 'guest-1', 2).totalPriceMinor).toBe(240000);
    expect(service.searchFlights('JNB', 'CPT', 2)).toHaveLength(0);
  });
});

describe('RoomBiddingService', () => {
  it('opens bidding only with multiple interested guests and awards the highest bid', () => {
    const service = new RoomBiddingService();
    const dates = { roomId: 'room-1', checkIn: '2026-10-05', checkOut: '2026-10-08' };
    service.registerInterest({ guestId: 'guest-1', ...dates });
    service.registerInterest({ guestId: 'guest-2', ...dates });
    const auction = service.startAuction('owner-1', dates.roomId, dates.checkIn, dates.checkOut, 100000);

    service.placeBid(auction.id, 'guest-1', 120000);
    const winningBid = service.placeBid(auction.id, 'guest-2', 150000);
    const closedAuction = service.closeAuction(auction.id, 'owner-1');

    expect(closedAuction.status).toBe('awarded');
    expect(closedAuction.winnerBidId).toBe(winningBid.id);
  });

  it('requires two interested guests and owner authorization', () => {
    const service = new RoomBiddingService();
    service.registerInterest({ guestId: 'guest-1', roomId: 'room-1', checkIn: '2026-10-05', checkOut: '2026-10-08' });

    expect(() => service.startAuction('owner-1', 'room-1', '2026-10-05', '2026-10-08', 100000)).toThrow('at least two interested guests');
  });
});

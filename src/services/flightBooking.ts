export interface FlightOffer {
  id: string;
  providerName: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  priceMinor: number;
  currency: string;
  availableSeats: number;
}

export interface FlightBooking {
  id: string;
  offerId: string;
  guestId: string;
  passengerCount: number;
  totalPriceMinor: number;
  currency: string;
  status: 'confirmed' | 'cancelled';
}

export class FlightBookingService {
  private readonly offers = new Map<string, FlightOffer>();
  private readonly bookings = new Map<string, FlightBooking>();
  private offerSequence = 0;
  private bookingSequence = 0;

  addFlightOffer(input: Omit<FlightOffer, 'id'>): FlightOffer {
    if (!input.origin.trim() || !input.destination.trim() || input.availableSeats < 1 || input.priceMinor <= 0) {
      throw new Error('Origin, destination, seats, and a positive price are required');
    }
    if (Number.isNaN(Date.parse(input.departureAt)) || Number.isNaN(Date.parse(input.arrivalAt)) || Date.parse(input.arrivalAt) <= Date.parse(input.departureAt)) {
      throw new Error('Flight departure and arrival must be valid dates');
    }

    const offer: FlightOffer = {
      ...input,
      id: `flight-${++this.offerSequence}`,
      currency: input.currency.toUpperCase(),
    };
    this.offers.set(offer.id, offer);
    return offer;
  }

  searchFlights(origin: string, destination: string, passengerCount = 1): FlightOffer[] {
    if (passengerCount < 1 || !Number.isInteger(passengerCount)) {
      throw new Error('passengerCount must be a positive integer');
    }
    return Array.from(this.offers.values())
      .filter((offer) => offer.origin.toLowerCase() === origin.toLowerCase())
      .filter((offer) => offer.destination.toLowerCase() === destination.toLowerCase())
      .filter((offer) => offer.availableSeats >= passengerCount)
      .sort((firstOffer, secondOffer) => firstOffer.priceMinor - secondOffer.priceMinor);
  }

  bookFlight(offerId: string, guestId: string, passengerCount: number): FlightBooking {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Flight offer ${offerId} was not found`);
    if (!guestId.trim() || passengerCount < 1 || !Number.isInteger(passengerCount)) {
      throw new Error('Guest and passengerCount are required');
    }
    if (offer.availableSeats < passengerCount) {
      throw new Error('Not enough seats are available');
    }

    offer.availableSeats -= passengerCount;
    const booking: FlightBooking = {
      id: `flight-booking-${++this.bookingSequence}`,
      offerId,
      guestId,
      passengerCount,
      totalPriceMinor: passengerCount * offer.priceMinor,
      currency: offer.currency,
      status: 'confirmed',
    };
    this.bookings.set(booking.id, booking);
    return booking;
  }
}

export default new FlightBookingService();

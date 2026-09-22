export interface RoomInterest {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
}

export interface RoomBid {
  id: string;
  guestId: string;
  amountMinor: number;
  createdAt: string;
}

export interface RoomAuction {
  id: string;
  roomId: string;
  ownerId: string;
  checkIn: string;
  checkOut: string;
  minimumBidMinor: number;
  interestedGuestIds: string[];
  bids: RoomBid[];
  status: 'open' | 'awarded' | 'cancelled' | 'no_bids';
  winnerBidId?: string;
  createdAt: string;
}

export class RoomBiddingService {
  private readonly interests: RoomInterest[] = [];
  private readonly auctions = new Map<string, RoomAuction>();
  private auctionSequence = 0;
  private bidSequence = 0;

  registerInterest(interest: RoomInterest): RoomInterest {
    this.validateRange(interest.checkIn, interest.checkOut);
    if (!interest.guestId.trim() || !interest.roomId.trim()) throw new Error('Guest and room are required');
    if (!this.interests.some((existing) => this.sameInterest(existing, interest))) {
      this.interests.push(interest);
    }
    return interest;
  }

  getInterestCount(roomId: string, checkIn: string, checkOut: string): number {
    return new Set(this.interests
      .filter((interest) => interest.roomId === roomId && interest.checkIn === checkIn && interest.checkOut === checkOut)
      .map((interest) => interest.guestId)).size;
  }

  startAuction(ownerId: string, roomId: string, checkIn: string, checkOut: string, minimumBidMinor: number): RoomAuction {
    this.validateRange(checkIn, checkOut);
    if (!ownerId.trim() || !roomId.trim()) throw new Error('Owner and room are required');
    if (!Number.isSafeInteger(minimumBidMinor) || minimumBidMinor <= 0) throw new Error('minimumBidMinor must be positive');

    const interestedGuestIds = Array.from(new Set(this.interests
      .filter((interest) => interest.roomId === roomId && interest.checkIn === checkIn && interest.checkOut === checkOut)
      .map((interest) => interest.guestId)));
    if (interestedGuestIds.length < 2) {
      throw new Error('Room bidding requires at least two interested guests for the same dates');
    }

    const auction: RoomAuction = {
      id: `room-auction-${++this.auctionSequence}`,
      roomId,
      ownerId,
      checkIn,
      checkOut,
      minimumBidMinor,
      interestedGuestIds,
      bids: [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.auctions.set(auction.id, auction);
    return auction;
  }

  placeBid(auctionId: string, guestId: string, amountMinor: number): RoomBid {
    const auction = this.requireAuction(auctionId);
    if (auction.status !== 'open') throw new Error('Room auction is no longer open');
    if (!auction.interestedGuestIds.includes(guestId)) throw new Error('Only interested guests may bid');
    if (!Number.isSafeInteger(amountMinor) || amountMinor < auction.minimumBidMinor) {
      throw new Error('Bid must meet the minimum bid amount');
    }

    const bid: RoomBid = { id: `room-bid-${++this.bidSequence}`, guestId, amountMinor, createdAt: new Date().toISOString() };
    auction.bids.push(bid);
    return bid;
  }

  closeAuction(auctionId: string, ownerId: string): RoomAuction {
    const auction = this.requireAuction(auctionId);
    if (auction.ownerId !== ownerId) throw new Error('Only the room owner can close the auction');
    if (auction.status !== 'open') throw new Error('Room auction is no longer open');

    const winningBid = [...auction.bids].sort((firstBid, secondBid) => (
      secondBid.amountMinor - firstBid.amountMinor
      || Date.parse(firstBid.createdAt) - Date.parse(secondBid.createdAt)
    ))[0];
    if (!winningBid) {
      auction.status = 'no_bids';
      return auction;
    }

    auction.status = 'awarded';
    auction.winnerBidId = winningBid.id;
    return auction;
  }

  getAuction(auctionId: string): RoomAuction | undefined {
    return this.auctions.get(auctionId);
  }

  private sameInterest(first: RoomInterest, second: RoomInterest): boolean {
    return first.guestId === second.guestId
      && first.roomId === second.roomId
      && first.checkIn === second.checkIn
      && first.checkOut === second.checkOut;
  }

  private requireAuction(auctionId: string): RoomAuction {
    const auction = this.auctions.get(auctionId);
    if (!auction) throw new Error(`Room auction ${auctionId} was not found`);
    return auction;
  }

  private validateRange(checkIn: string, checkOut: string): void {
    if (Number.isNaN(Date.parse(checkIn)) || Number.isNaN(Date.parse(checkOut)) || Date.parse(checkOut) <= Date.parse(checkIn)) {
      throw new Error('checkIn and checkOut must be valid dates with checkOut after checkIn');
    }
  }
}

export default new RoomBiddingService();

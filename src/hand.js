// Rotating 10-card cycle (Clash Royale style).
// Playing a card sends it to the back; the next card slides into hand.
export class Hand {
  constructor(deckCards) {
    this._cycle = [...deckCards].sort(() => Math.random() - 0.5);
    this.handSize = 4;
    console.log('[Hand] created, deck:', [...deckCards], 'initial hand:', this._cycle.slice(0, 4));
  }

  // The 4 cards currently visible in hand
  get cards() {
    return this._cycle.slice(0, this.handSize);
  }

  // The card peeking after the hand (5th position)
  get nextCard() {
    return this._cycle[this.handSize] ?? null;
  }

  // Play card at hand index (0–3). Moves it to back of cycle. Returns card id.
  play(handIndex) {
    if (handIndex < 0 || handIndex >= this.handSize) return null;
    const [cardId] = this._cycle.splice(handIndex, 1);
    this._cycle.push(cardId);
    return cardId;
  }

  // Re-shuffle for a new match (same deck composition)
  reset() {
    this._cycle.sort(() => Math.random() - 0.5);
  }
}

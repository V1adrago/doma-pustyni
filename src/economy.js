import { CONFIG } from './config.js';

export class SpiceEconomy {
  /**
   * @param {{ left: {alive:boolean}, citadel: {alive:boolean}, right: {alive:boolean} }} towerState
   *   Live reference — mutations to towerState objects are immediately reflected here.
   */
  constructor(towerState) {
    this.towerState    = towerState;
    this.spices        = CONFIG.startingSpices;
    this.spiceBank     = CONFIG.baseSpiceBank;
    this.engineerStage = 0;
    this.engineerIncome = 0; // extra income/min from active engineer extraction
    this._accumulator  = 0;
  }

  // ── Read-only derived values ────────────────────────────────────────────────

  /** Total income per minute based on alive towers + active engineer */
  get incomePerMinute() {
    let income = 0;
    if (this.towerState.citadel.alive) income += CONFIG.citadelIncomePerMinute;
    if (this.towerState.left.alive)    income += CONFIG.sideTowerIncomePerMinute;
    if (this.towerState.right.alive)   income += CONFIG.sideTowerIncomePerMinute;
    income += this.engineerIncome;
    return income;
  }

  /** Income per second (used in tick) */
  get incomePerSecond() {
    return this.incomePerMinute / 60;
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  canAfford(cost) { return this.spices >= cost; }

  spend(amount) { this.spices = Math.max(0, this.spices - amount); }

  // Called when an engineer unit reaches the resource node.
  // Cost is paid up-front when the card is played; this just applies the stage bonus.
  activateEngineerStage() {
    const stage = this.engineerStage + 1;
    if (stage > 3) return false;
    const cfg = CONFIG.engineers[stage - 1];
    this.engineerStage  = stage;
    this.engineerIncome = cfg.income;
    this.spiceBank      = cfg.bank;
    return true;
  }

  /** Advance economy by deltaSeconds. Accumulates fractional spices. */
  tick(deltaSeconds) {
    this._accumulator += this.incomePerSecond * deltaSeconds;
    const earned = Math.floor(this._accumulator);
    if (earned > 0) {
      this._accumulator -= earned;
      this.spices = Math.min(this.spices + earned, this.spiceBank);
    }
  }

  /** Full reset to match start state */
  reset() {
    this.spices         = CONFIG.startingSpices;
    this.spiceBank      = CONFIG.baseSpiceBank;
    this.engineerStage  = 0;
    this.engineerIncome = 0;
    this._accumulator   = 0;
  }
}

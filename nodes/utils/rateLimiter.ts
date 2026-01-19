export class RateLimiter {
	private tokens: number;
	private lastRefill: number;
	private capacity: number;
	private rate: number;

	constructor(rate: number, capacity: number = 10) {
		this.rate = rate;
		this.capacity = capacity;
		this.tokens = capacity;
		this.lastRefill = Date.now();
	}

	async acquire(): Promise<void> {
		this.refill();

		if (this.tokens < 1) {
			const waitTime = this.calculateWaitTime();
			await this.sleep(waitTime);
			return this.acquire();
		}

		this.tokens--;
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;
		const tokensToAdd = (elapsed / 1000) * this.rate;

		this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
		this.lastRefill = now;
	}

	private calculateWaitTime(): number {
		const tokensNeeded = 1 - this.tokens;
		const timeToWait = (tokensNeeded / this.rate) * 1000;
		return Math.ceil(timeToWait);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	getAvailableTokens(): number {
		this.refill();
		return this.tokens;
	}

	reset(): void {
		this.tokens = this.capacity;
		this.lastRefill = Date.now();
	}
}

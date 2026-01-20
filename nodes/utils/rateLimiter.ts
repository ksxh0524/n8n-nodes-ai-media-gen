import type { IRateLimiterOptions } from './types';

export class RateLimiter {
	private static instances: Map<string, RateLimiter> = new Map();
	private tokens: number;
	private lastRefill: number;
	private capacity: number;
	private rate: number;
	private key: string;

	constructor(rate: number, capacity: number = 10, key: string = 'default') {
		this.rate = rate;
		this.capacity = capacity;
		this.tokens = capacity;
		this.lastRefill = Date.now();
		this.key = key;
	}

	static getInstance(options: IRateLimiterOptions): RateLimiter {
		const { rate, capacity = 10, key = 'default' } = options;
		const instanceKey = `${key}:${rate}:${capacity}`;
		
		if (!RateLimiter.instances.has(instanceKey)) {
			RateLimiter.instances.set(instanceKey, new RateLimiter(rate, capacity, key));
		}
		
		return RateLimiter.instances.get(instanceKey)!;
	}

	static clearInstance(key: string = 'default'): void {
		const keysToDelete: string[] = [];
		for (const [instanceKey] of RateLimiter.instances) {
			if (instanceKey.startsWith(`${key}:`)) {
				keysToDelete.push(instanceKey);
			}
		}
		keysToDelete.forEach(k => RateLimiter.instances.delete(k));
	}

	static clearAllInstances(): void {
		RateLimiter.instances.clear();
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

	getKey(): string {
		return this.key;
	}
}

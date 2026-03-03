import { describe, it, expect } from 'vitest';
import {
	formatCurrency,
	formatTokens,
	formatDuration,
	formatPercent,
	truncateId,
} from './format';

describe('formatCurrency', () => {
	it('formats whole dollar amounts', () => {
		expect(formatCurrency(1.5)).toBe('$1.50');
	});

	it('formats zero', () => {
		expect(formatCurrency(0)).toBe('$0.00');
	});

	it('shows <$0.01 for tiny amounts', () => {
		expect(formatCurrency(0.001)).toBe('<$0.01');
	});

	it('formats larger amounts', () => {
		expect(formatCurrency(123.456)).toBe('$123.46');
	});
});

describe('formatTokens', () => {
	it('returns raw number for small counts', () => {
		expect(formatTokens(500)).toBe('500');
	});

	it('formats thousands as K', () => {
		expect(formatTokens(1500)).toBe('1.5K');
	});

	it('formats millions as M', () => {
		expect(formatTokens(2_500_000)).toBe('2.5M');
	});
});

describe('formatDuration', () => {
	it('formats seconds under a minute', () => {
		expect(formatDuration(45)).toBe('45s');
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(125)).toBe('2m 5s');
	});

	it('formats hours and minutes', () => {
		expect(formatDuration(3725)).toBe('1h 2m');
	});
});

describe('formatPercent', () => {
	it('adds + sign for positive', () => {
		expect(formatPercent(15.3)).toBe('+15.3%');
	});

	it('keeps - sign for negative', () => {
		expect(formatPercent(-8.7)).toBe('-8.7%');
	});
});

describe('truncateId', () => {
	it('truncates long ids', () => {
		expect(truncateId('abcdefghijklmnop')).toBe('abcdefghijkl');
	});

	it('returns short ids as-is', () => {
		expect(truncateId('abc')).toBe('abc');
	});
});

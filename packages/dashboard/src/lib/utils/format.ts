/**
 * Pure formatting utilities for dashboard display values.
 */

export const formatCurrency = (amount: number): string => {
	if (amount < 0.01 && amount > 0) return '<$0.01';
	return `$${amount.toFixed(2)}`;
};

export const formatTokens = (count: number): string => {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
	return String(count);
};

export const formatDuration = (seconds: number): string => {
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.round(seconds % 60);
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
};

export const formatTimestamp = (iso: string): string => {
	const d = new Date(iso);
	return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDate = (iso: string): string => {
	const d = new Date(iso);
	return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatPercent = (value: number): string => {
	const sign = value > 0 ? '+' : '';
	return `${sign}${value.toFixed(1)}%`;
};

export const truncateId = (id: string, length = 12): string =>
	id.length > length ? id.substring(0, length) : id;

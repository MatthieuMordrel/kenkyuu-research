// General utilities for the monorepo
// Add your shared utility functions here
export function formatDate(date) {
    return date.toISOString();
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function isNonNullable(value) {
    return value !== null && value !== undefined;
}

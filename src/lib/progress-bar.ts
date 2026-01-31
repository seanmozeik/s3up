// src/lib/progress-bar.ts
// Custom gradient progress bar for chunked uploads

import gradient from 'gradient-string';
import { frappe, gradientColors, theme } from '../ui/theme';

// Create gradient using existing Catppuccin palette
const progressGradient = gradient([...gradientColors.banner]);

export interface ProgressState {
  filename: string;
  completedParts: number;
  totalParts: number;
  bytesUploaded: number;
  totalBytes: number;
  startTime: number;
  recentSamples: { time: number; bytes: number }[];
}

/**
 * Create initial progress state
 */
export function createProgressState(
  filename: string,
  totalParts: number,
  totalBytes: number
): ProgressState {
  return {
    bytesUploaded: 0,
    completedParts: 0,
    filename,
    recentSamples: [{ bytes: 0, time: Date.now() }],
    startTime: Date.now(),
    totalBytes,
    totalParts
  };
}

/**
 * Update progress state with a completed part
 */
export function updateProgress(state: ProgressState, bytesUploaded: number): void {
  state.completedParts++;
  state.bytesUploaded += bytesUploaded;

  // Add sample for speed calculation (keep last 30 seconds for slow uploads)
  const now = Date.now();
  state.recentSamples.push({ bytes: state.bytesUploaded, time: now });

  // Remove samples older than 30 seconds
  const cutoff = now - 30000;
  state.recentSamples = state.recentSamples.filter((s) => s.time >= cutoff);
}

/**
 * Calculate transfer speed (bytes per second)
 * Uses overall average if recent samples insufficient
 */
function calculateSpeed(state: ProgressState): number {
  // Try recent samples first
  if (state.recentSamples.length >= 2) {
    const oldest = state.recentSamples[0];
    const newest = state.recentSamples[state.recentSamples.length - 1];

    const timeDiff = (newest.time - oldest.time) / 1000;
    if (timeDiff > 0) {
      const bytesDiff = newest.bytes - oldest.bytes;
      return bytesDiff / timeDiff;
    }
  }

  // Fall back to overall average speed
  const elapsed = (Date.now() - state.startTime) / 1000;
  if (elapsed > 0 && state.bytesUploaded > 0) {
    return state.bytesUploaded / elapsed;
  }

  return 0;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format speed to human readable
 */
function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Render the progress bar string
 */
export function renderProgressBar(state: ProgressState, width = 30): string {
  const percent =
    state.totalBytes > 0 ? Math.round((state.bytesUploaded / state.totalBytes) * 100) : 0;
  const filledWidth = Math.round((percent / 100) * width);
  const emptyWidth = width - filledWidth;

  // Create bar characters
  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);

  // Apply gradient to filled portion
  const gradientBar = filledWidth > 0 ? progressGradient(filledBar) : '';
  const fullBar = gradientBar + frappe.surface0(emptyBar);

  // Calculate speed
  const speed = calculateSpeed(state);
  const speedStr = formatSpeed(speed);

  // Format: ████░░░░░░ [5/20] 25% (12.3 MB/s)
  const chunkInfo = `[${state.completedParts}/${state.totalParts}]`;
  const percentStr = `${percent}%`;

  return `${fullBar} ${frappe.subtext0(chunkInfo)} ${frappe.text(percentStr)} ${theme.dim(`(${speedStr})`)}`;
}

/**
 * Render progress line with filename (for terminal output)
 */
export function renderProgressLine(state: ProgressState): string {
  const bar = renderProgressBar(state);
  return `  ${bar}`;
}

/**
 * Clear line and move cursor to start
 */
export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

/**
 * Write progress to terminal (same line)
 */
export function writeProgress(state: ProgressState): void {
  clearLine();
  process.stdout.write(renderProgressLine(state));
}

/**
 * Finish progress (move to next line)
 */
export function finishProgress(): void {
  console.log();
}

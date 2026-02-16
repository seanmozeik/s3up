// src/ui/banner.ts

import { dirname, join } from 'node:path';
import figlet from 'figlet';
import gradient from 'gradient-string';
// Embed font file — vendored so it works in dev, compiled binary, and npm installs
// @ts-expect-error - Bun-specific import attribute
import fontPath from './Slant.flf' with { type: 'file' };
import { gradientColors } from './theme.js';

// Create custom gradient using Catppuccin Frappe colors
const bannerGradient = gradient([...gradientColors.banner]);

// Lazy font loading for bytecode caching compatibility (no top-level await)
let fontLoaded = false;

async function ensureFontLoaded(): Promise<void> {
  if (fontLoaded) return;
  // In dev: fontPath is absolute. In bundled builds: fontPath is relative
  // Use Bun.main for runtime path (import.meta.dir returns source dir with bytecode)
  const resolvedFontPath = fontPath.startsWith('/') ? fontPath : join(dirname(Bun.main), fontPath);
  const fontContent = await Bun.file(resolvedFontPath).text();
  figlet.parseFont('Slant', fontContent);
  fontLoaded = true;
}

/**
 * Display the ASCII art banner with gradient colors
 */
export async function showBanner(): Promise<void> {
  await ensureFontLoaded();

  const banner = figlet.textSync('s3up', {
    font: 'Slant',
    horizontalLayout: 'default'
  });

  const indent = '  ';
  const indentedBanner = banner
    .split('\n')
    .map((line) => indent + line)
    .join('\n');

  console.log();
  console.log(`\n${bannerGradient(indentedBanner)}\n`);
  console.log();
}

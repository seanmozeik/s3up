// src/ui/banner.ts
import figlet from "figlet";
import gradient from "gradient-string";
// Embed font file for Bun standalone executable
// @ts-expect-error - Bun-specific import attribute
import fontPath from "../../node_modules/figlet/fonts/ANSI Shadow.flf" with {
	type: "file",
};
import { gradientColors } from "./theme.js";

// Create custom gradient using Catppuccin Frappe colors
const bannerGradient = gradient([...gradientColors.banner]);

// Load and register the embedded font
let fontLoaded = false;

async function ensureFontLoaded(): Promise<void> {
	if (fontLoaded) return;
	const fontContent = await Bun.file(fontPath).text();
	figlet.parseFont("ANSI Shadow", fontContent);
	fontLoaded = true;
}

/**
 * Display the ASCII art banner with gradient colors
 */
export async function showBanner(): Promise<void> {
	await ensureFontLoaded();

	const banner = figlet.textSync("S3UP", {
		font: "ANSI Shadow",
		horizontalLayout: "default",
	});

	const indent = "  ";
	const indentedBanner = banner
		.split("\n")
		.map((line) => indent + line)
		.join("\n");

	console.log();
	console.log();
	console.log(bannerGradient(indentedBanner));
	console.log();
}

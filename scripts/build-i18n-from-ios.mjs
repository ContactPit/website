import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");
const sourcePath = path.resolve(projectRoot, "../iOS-app/Localizable/Localizable.xcstrings");
const outputPath = path.resolve(projectRoot, "shared/ios-messages.generated.js");

function readStringValue(entry, locale) {
  return entry?.localizations?.[locale]?.stringUnit?.value ?? "";
}

let sourceExists = true;
try {
  await fs.access(sourcePath);
} catch {
  sourceExists = false;
}

if (!sourceExists) {
  console.warn(`[build:i18n] Skipping iOS catalog import because source file is missing: ${sourcePath}`);
  console.warn(`[build:i18n] Using committed generated messages at: ${outputPath}`);
} else {
  const raw = await fs.readFile(sourcePath, "utf8");
  const catalog = JSON.parse(raw);
  const strings = catalog?.strings ?? {};

  const messages = {
    en: {},
    et: {},
  };

  for (const [key, entry] of Object.entries(strings)) {
    if (!key) continue;
    const english = readStringValue(entry, "en") || key;
    const estonian = readStringValue(entry, "et-EE") || english;
    messages.en[key] = english;
    messages.et[key] = estonian;
  }

  const fileContents = `export const iosMessages = ${JSON.stringify(messages, null, 2)};\n`;
  await fs.writeFile(outputPath, fileContents, "utf8");
}

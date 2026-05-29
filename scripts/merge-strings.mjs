import fs from 'fs';

const original = JSON.parse(fs.readFileSync('scripts/original_strings.json', 'utf8'));
const current = JSON.parse(fs.readFileSync('src/lib/ui_strings_generated.json', 'utf8'));

const langs = ['en', 'ko', 'zh', 'ja', 'es'];
const merged = { en: {}, ko: {}, zh: {}, ja: {}, es: {} };

// Collect all keys from both files
const allKeys = new Set([
  ...Object.keys(original.en || {}),
  ...Object.keys(current.en || {}),
]);

for (const key of allKeys) {
  for (const lang of langs) {
    const currentVal = (current[lang] || {})[key];
    const originalVal = (original[lang] || {})[key];
    // Use current value if non-empty, else fall back to original
    merged[lang][key] = (currentVal !== undefined && currentVal !== '') ? currentVal : (originalVal || '');
  }
}

fs.writeFileSync('src/lib/ui_strings_generated.json', JSON.stringify(merged, null, 2));
console.log(`Merged. Total keys: ${allKeys.size}`);

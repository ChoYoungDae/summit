import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
const { data, error } = await supabase
  .from('i18n_glossary')
  .select('*')
  .eq('category', 'ui');

if (error) { console.error(error); process.exit(1); }

const uiStrings: Record<string, Record<string, string>> = { en: {}, ko: {}, zh: {}, ja: {}, es: {} };

for (const item of data || []) {
  if (!item.key) continue;
  uiStrings.en[item.key] = item.en || '';
  uiStrings.ko[item.key] = item.ko || '';
  uiStrings.zh[item.key] = item.zh || '';
  uiStrings.ja[item.key] = item.ja || '';
  uiStrings.es[item.key] = item.es || '';
}

const outputPath = path.join(process.cwd(), 'src/lib/ui_strings_generated.json');
fs.writeFileSync(outputPath, JSON.stringify(uiStrings, null, 2));
console.log('Done — ui_strings_generated.json updated.');
}

main();

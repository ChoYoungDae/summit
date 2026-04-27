import { createClient } from '@supabase/supabase-js';
import { UI_STRINGS } from '../src/lib/i18n';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrate() {
  const locales = ['ko', 'en', 'zh', 'ja', 'es'] as const;
  const keys = Object.keys(UI_STRINGS.ko) as Array<keyof typeof UI_STRINGS.ko>;

  console.log(`Migrating ${keys.length} UI strings...`);

  for (const key of keys) {
    const entry = {
      category: 'ui',
      key: key, // Store the TS key (e.g. 'settings')
      ko: UI_STRINGS.ko[key] || '',
      en: UI_STRINGS.en[key] || '',
      zh: UI_STRINGS.zh[key] || '',
      ja: UI_STRINGS.ja[key] || '',
      es: UI_STRINGS.es[key] || '',
    };

    const { error } = await supabase
      .from('i18n_glossary')
      .upsert(entry, { onConflict: 'ko' });

    if (error) {
      console.error(`Error migrating key "${key}":`, error.message);
    }
  }

  console.log('Migration complete!');
}

migrate();

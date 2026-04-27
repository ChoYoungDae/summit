import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';

// Note: Next.js handles env vars automatically. 
// For standalone scripts, dotenv is handled in the script file itself.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

interface LocalizedText {
  ko: string;
  en?: string;
  zh?: string;
  ja?: string;
  es?: string;
}

interface TranslationMeta {
  source_hash?: string;
  translated_at?: string;
}

async function getGlossary() {
  const { data, error } = await supabase.from('i18n_glossary').select('*');
  if (error) {
    console.error('Error fetching glossary:', error);
    return [];
  }
  return data;
}

function calculateHash(text: string) {
  return crypto.createHash('md5').update(text).digest('hex');
}

async function translateText(ko: string, en: string, glossary: any[]) {
  const needsEn = !en;
  const prompt = `
You are a professional translator for a hiking app called "Summit".
Translate the following hiking-related text into ${needsEn ? 'English, ' : ''}Chinese (Simplified), Japanese, and Spanish.

Source:
Korean: ${ko}
${en ? `English: ${en}` : '(English translation needed)'}

Glossary for consistency:
${glossary.map(g => `- ${g.ko} (${g.en}) -> zh: ${g.zh || '?'}, ja: ${g.ja || '?'}, es: ${g.es || '?'}`).join('\n')}

Rules:
1. Use the glossary for technical terms and proper nouns.
2. For the Korean term "계곡", use "Valley" when referring to a trail or terrain, and "Stream" only when referring to actual water.
3. Maintain the tone of a professional hiking guide.
4. Return ONLY a JSON object with keys ${needsEn ? '"en", ' : ''}"zh", "ja", "es". No markdown blocks.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (err) {
    console.error(`Translation failed for "${ko}":`, err);
    return null;
  }
}

async function processTable(tableName: string, textColumn: string) {
  console.log(`Processing table: ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select(`id, ${textColumn}, translation_meta`);
  
  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }

  const glossary = await getGlossary();

  for (const item of data) {
    const localized = (item as any)[textColumn] as LocalizedText;
    if (!localized?.ko) continue;

    const sourceText = `${localized.ko}|${localized.en || ''}`;
    const currentHash = calculateHash(sourceText);
    const meta = ((item as any).translation_meta || {}) as TranslationMeta;

    if (meta.source_hash === currentHash && localized.en && localized.zh && localized.ja && localized.es) {
      continue;
    }

    console.log(`Translating/Updating item ${(item as any).id} in ${tableName}...`);
    const translations = await translateText(localized.ko, localized.en || '', glossary);

    if (translations) {
      const updatedLocalized = { ...localized, ...translations };
      const updatedHash = calculateHash(`${localized.ko}|${updatedLocalized.en}`);
      const updatedMeta = { ...meta, source_hash: updatedHash, translated_at: new Date().toISOString() };
      await supabase.from(tableName).update({ [textColumn]: updatedLocalized, translation_meta: updatedMeta }).eq('id', (item as any).id);
    }
  }
}

async function syncUIStrings() {
  console.log('Syncing UI strings from DB to code...');
  const { data, error } = await supabase.from('i18n_glossary').select('*').eq('category', 'ui');
  
  if (error) {
    console.error('Error fetching UI strings:', error);
    return;
  }

  const glossary = await getGlossary();
  const uiStrings: Record<string, Record<string, string>> = { en: {}, ko: {}, zh: {}, ja: {}, es: {} };

  for (const item of data) {
    if (!(item as any).key) continue;

    const sourceText = `${(item as any).ko}|${(item as any).en || ''}`;
    const currentHash = calculateHash(sourceText);
    const meta = ((item as any).translation_meta || {}) as TranslationMeta;

    if (meta.source_hash !== currentHash || !(item as any).en || !(item as any).zh || !(item as any).ja || !(item as any).es) {
        console.log(`Translating/Updating UI key: ${(item as any).key}...`);
        const translations = await translateText((item as any).ko, (item as any).en || '', glossary);
        if (translations) {
            const updatedItem = { ...item, ...translations };
            const updatedHash = calculateHash(`${(item as any).ko}|${(updatedItem as any).en}`);
            const updatedMeta = { ...meta, source_hash: updatedHash, translated_at: new Date().toISOString() };
            
            await supabase.from('i18n_glossary').update({ 
              en: (updatedItem as any).en,
              zh: (updatedItem as any).zh, 
              ja: (updatedItem as any).ja, 
              es: (updatedItem as any).es,
              translation_meta: updatedMeta 
            }).eq('id', (item as any).id);
            
            (item as any).en = (updatedItem as any).en;
            (item as any).zh = (updatedItem as any).zh;
            (item as any).ja = (updatedItem as any).ja;
            (item as any).es = (updatedItem as any).es;
        }
    }

    uiStrings.en[(item as any).key] = (item as any).en || '';
    uiStrings.ko[(item as any).key] = (item as any).ko;
    uiStrings.zh[(item as any).key] = (item as any).zh || '';
    uiStrings.ja[(item as any).key] = (item as any).ja || '';
    uiStrings.es[(item as any).key] = (item as any).es || '';
  }

  const outputPath = path.join(process.cwd(), 'src/lib/ui_strings_generated.json');
  fs.writeFileSync(outputPath, JSON.stringify(uiStrings, null, 2));
}

export async function runFullSync() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  await processTable('mountains', 'name');
  await processTable('routes', 'name');
  await processTable('waypoints', 'name');
  await processTable('waypoints', 'description');
  await processTable('segments', 'name');
  await processTable('route_photos', 'description');
  
  await syncUIStrings();
  
  return { success: true };
}

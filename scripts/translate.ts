import dotenv from 'dotenv';
import { runFullSync } from '../src/lib/translate_service';

dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log('Starting translation sync...');
    await runFullSync();
    console.log('Translation sync completed successfully!');
  } catch (err) {
    console.error('Translation sync failed:', err);
    process.exit(1);
  }
}

main();

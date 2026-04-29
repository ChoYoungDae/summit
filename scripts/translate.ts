import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log('Starting translation sync...');
    const { runFullSync } = await import('../src/lib/translate_service');
    await runFullSync();

    console.log('Translation sync completed successfully!');
  } catch (err) {
    console.error('Translation sync failed:', err);
    process.exit(1);
  }
}

main();

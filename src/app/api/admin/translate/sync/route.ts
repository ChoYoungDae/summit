import { NextResponse } from 'next/server';
import { runFullSync } from '@/lib/translate_service';

export async function POST() {
  try {
    // Only allow in development or with a secret key if needed.
    // For now, let's just run it as it's an admin-only intended feature.
    await runFullSync();
    return NextResponse.json({ success: true, message: 'Full translation sync completed.' });
  } catch (error: any) {
    console.error('Translation Sync API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { restorePropertyData } from '@/services/backupService';
import { initializeFirebase } from '@/firebase/init';

export async function POST(req: NextRequest) {
  try {
    const { payload, adminEmail } = await req.json();
    const { firestore } = initializeFirebase();

    if (!payload || !adminEmail) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await restorePropertyData(firestore, payload);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

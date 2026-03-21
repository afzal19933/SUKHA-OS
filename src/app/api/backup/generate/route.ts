import { NextRequest, NextResponse } from 'next/server';
import { generatePropertyBackup } from '@/services/backupService';
import { initializeFirebase } from '@/firebase/init';

export async function POST(req: NextRequest) {
  try {
    const { entityId, propertyName, userEmail } = await req.json();
    const { firestore } = initializeFirebase();

    if (!entityId || !userEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const backup = await generatePropertyBackup(firestore, entityId, propertyName, userEmail);
    
    return NextResponse.json(backup);
  } catch (error: any) {
    console.error("Backup generation API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

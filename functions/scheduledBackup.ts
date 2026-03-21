/**
 * Firebase Scheduled Function for SUKHA OS.
 * Triggers automated backups across all active property entities.
 * Note: This file serves as a template for deployment via Firebase CLI.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

const PROPERTY_COLLECTIONS = [
  "reservations", "rooms", "invoices", "housekeeping_tasks", "inventory_stocks"
];

export const dailyAutoBackup = functions.pubsub.schedule('0 0 * * *')
  .onRun(async (context) => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch all properties
    const propertiesSnapshot = await db.collection('hotel_properties').get();
    
    for (const propDoc of propertiesSnapshot.docs) {
      const entityId = propDoc.id;
      const backupData: any = { metadata: { date: today, entityId }, data: {} };

      // 2. Extract key data
      for (const col of PROPERTY_COLLECTIONS) {
        const snap = await propDoc.ref.collection(col).get();
        backupData.data[col] = snap.docs.map(d => d.data());
      }

      // 3. Store in vault
      const file = bucket.file(`backups/${entityId}/${today}/auto_daily.json`);
      await file.save(JSON.stringify(backupData), {
        metadata: { contentType: 'application/json' }
      });

      console.log(`[AutoBackup] Completed for ${entityId}`);
    }

    return null;
  });

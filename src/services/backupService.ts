'use client';

import { 
  collection, 
  getDocs, 
  query, 
  where, 
  Firestore, 
  doc, 
  getDoc,
  writeBatch,
  CollectionReference,
  DocumentData
} from "firebase/firestore";

export interface BackupMetadata {
  version: string;
  propertyId: string;
  propertyName: string;
  createdAt: string;
  createdBy: string;
  totalRecords: number;
  collections: string[];
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

const PROPERTY_SUB_COLLECTIONS = [
  "reservations",
  "rooms",
  "room_types",
  "invoices",
  "guest_laundry_orders",
  "linen_laundry_batches",
  "laundry_vendor_payments",
  "laundry_items",
  "housekeeping_tasks",
  "inventory_stocks",
  "inventory_transactions",
  "supply_purchases",
  "whatsapp_logs",
  "whatsapp_contacts",
  "gst_settings",
  "expenses"
];

/**
 * Fetches all data for a specific property entity.
 */
export async function generatePropertyBackup(
  db: Firestore, 
  entityId: string, 
  propertyName: string, 
  userEmail: string
): Promise<BackupPayload> {
  const backupData: Record<string, any[]> = {};
  let totalRecords = 0;

  // 1. Fetch Property Sub-collections
  for (const colName of PROPERTY_SUB_COLLECTIONS) {
    const colRef = collection(db, "hotel_properties", entityId, colName);
    const snapshot = await getDocs(colRef);
    backupData[colName] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    totalRecords += snapshot.docs.length;
  }

  // 2. Fetch relevant User Profiles
  const usersRef = collection(db, "user_profiles");
  const usersQuery = query(usersRef, where("entityId", "==", entityId));
  const usersSnapshot = await getDocs(usersQuery);
  backupData["user_profiles"] = usersSnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
  totalRecords += usersSnapshot.docs.length;

  return {
    metadata: {
      version: "1.0",
      propertyId: entityId,
      propertyName,
      createdAt: new Date().toISOString(),
      createdBy: userEmail,
      totalRecords,
      collections: [...PROPERTY_SUB_COLLECTIONS, "user_profiles"]
    },
    data: backupData
  };
}

/**
 * Restores data from a backup payload.
 */
export async function restorePropertyData(
  db: Firestore,
  payload: BackupPayload,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
  const { metadata, data } = payload;
  const entityId = metadata.propertyId;

  try {
    // 1. Restore User Profiles
    if (data.user_profiles) {
      onProgress?.("Restoring user profiles...");
      const batch = writeBatch(db);
      data.user_profiles.forEach(user => {
        const ref = doc(db, "user_profiles", user.id);
        batch.set(ref, user, { merge: true });
      });
      await batch.commit();
    }

    // 2. Restore Sub-collections
    for (const colName of PROPERTY_SUB_COLLECTIONS) {
      if (data[colName] && data[colName].length > 0) {
        onProgress?.(`Restoring ${colName} (${data[colName].length} records)...`);
        
        // Firestore batches are limited to 500 operations
        const chunks = [];
        for (let i = 0; i < data[colName].length; i += 450) {
          chunks.push(data[colName].slice(i, i + 450));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const ref = doc(db, "hotel_properties", entityId, colName, item.id);
            batch.set(ref, item, { merge: true });
          });
          await batch.commit();
        }
      }
    }

    return { success: true, message: `Successfully restored ${metadata.totalRecords} records.` };
  } catch (error: any) {
    console.error("Restore failed:", error);
    return { success: false, message: error.message };
  }
}

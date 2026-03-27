'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {

  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        memoizedDocRef,

        (snapshot: DocumentSnapshot<DocumentData>) => {
          try {
            if (snapshot.exists()) {
              const rawData = snapshot.data();

              // Return full document data
              setData({
                ...(rawData as T),
                id: snapshot.id,
              });
            } else {
              setData(null);
            }

            setError(null);
            setIsLoading(false);

          } catch (err) {
            console.error("Document parsing error", err);
            setError(err as Error);
            setData(null);
            setIsLoading(false);
          }
        },

        (error: FirestoreError) => {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          });

          console.error("Firestore doc listener error", error);

          setError(contextualError);
          setData(null);
          setIsLoading(false);

          errorEmitter.emit('permission-error', contextualError);
        }
      );
    } catch (err) {
      console.error("Doc listener init failed", err);
      setError(err as Error);
      setData(null);
      setIsLoading(false);
    }

    return () => unsubscribe();

  }, [memoizedDocRef]);

  return { data, isLoading, error };
}

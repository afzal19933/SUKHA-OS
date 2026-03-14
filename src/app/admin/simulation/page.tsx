
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * @fileOverview Simulation module removed.
 * Redirects legacy access to the dashboard.
 */

export default function SimulationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}

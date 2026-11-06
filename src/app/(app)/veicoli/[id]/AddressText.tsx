"use client";

import { useAddresses } from "@/lib/useAddresses";

export function AddressText({ lat, lon }: { lat: number; lon: number }) {
  const address = useAddresses([{ lat, lon }]);
  return <>{address(lat, lon) ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`}</>;
}

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'office-tv-device-id';

/** Synchronous – reads or creates the device ID directly from localStorage. Safe to call inside async handlers. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Overwrites the stored device ID – used when linking a new device to an existing player. */
export function setDeviceId(id: string): void {
  localStorage.setItem(DEVICE_ID_KEY, id);
}

export function useDeviceId(): string {
  const [deviceId, setDeviceIdState] = useState<string>('');

  useEffect(() => {
    setDeviceIdState(getDeviceId());
  }, []);

  return deviceId;
}

import { businessAPI } from "../api/auth";

const TTL = 5 * 60 * 1000;

let entry = { data: null, t: 0 };
let inflight = null;

export function invalidateBusinessProfile() {
  entry = { data: null, t: 0 };
  inflight = null;
}

export function peekBusinessProfile() {
  return entry.data;
}

export function getBusinessProfile() {
  if (entry.data && Date.now() - entry.t < TTL) {
    return Promise.resolve(entry.data);
  }
  if (inflight) return inflight;
  inflight = businessAPI
    .getProfile()
    .then((res) => {
      const data = res?.data?.data || null;
      if (data) entry = { data, t: Date.now() };
      return data;
    })
    .catch(() => entry.data)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function resolveBusinessProfile() {
  return peekBusinessProfile() || (await getBusinessProfile().catch(() => null));
}

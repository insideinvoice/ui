import { businessAPI } from "../api/auth";

// Freshness window: profile reads within this window reuse the last response
// (satisfied from memory — zero network wait on rapid actions like one-by-one
// invoice downloads). Settings saves call invalidateBusinessProfile() so a
// change (e.g. industry) still applies immediately everywhere.
const TTL_MS = 60_000;

let cached = null;      // { data, at }
let inflight = null;    // shared in-flight request for concurrent callers

export function getBusinessProfile() {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return Promise.resolve(cached.data);
  if (inflight) return inflight;
  inflight = businessAPI
    .getProfile()
    .then((res) => {
      const data = res?.data?.data || null;
      cached = { data, at: Date.now() };
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateBusinessProfile() {
  cached = null;
}

export async function resolveBusinessProfile() {
  return getBusinessProfile();
}

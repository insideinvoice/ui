import { businessAPI } from "../api/auth";

// No profile cache: every resolve fetches fresh from the server so a business
// setting change (e.g. industry) applies immediately everywhere. Concurrent
// callers within the same tick share one in-flight request.
let inflight = null;

export function getBusinessProfile() {
  if (inflight) return inflight;
  inflight = businessAPI
    .getProfile()
    .then((res) => res?.data?.data || null)
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function resolveBusinessProfile() {
  return getBusinessProfile();
}

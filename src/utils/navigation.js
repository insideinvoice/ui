// One history step back when the app has prior entries in this tab;
// otherwise fall back to an explicit route (deep link / fresh load).
export function goBack(navigate, fallback) {
  if (window.history.state?.idx > 0) {
    navigate(-1);
  } else if (fallback != null) {
    navigate(fallback);
  }
}

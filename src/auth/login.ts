export function startOidcLogin(): void {
  const path = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/oidc/login?path=${path}`);
}

/** Keep trailing-slash aliases inside the authentication boundary. */
export function isAuthPath(pathname: string): boolean {
  return ["/login", "/change-password", "/account"].includes(pathname.replace(/\/+$/, ""));
}

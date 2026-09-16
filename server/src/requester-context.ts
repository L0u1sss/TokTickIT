/** Read-only actor DTO supplied by the authenticated session middleware. */
export interface RequesterContext {
  id: number;
  displayName: string;
  email: string;
}

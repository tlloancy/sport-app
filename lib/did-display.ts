/** Short public handle from an AT Protocol DID. */
export function formatDidHandle(did: string): string {
  const body = did.replace(/^did:plc:/i, '').replace(/^did:/i, '');
  const short = body.slice(0, 8);
  return `@${short}…`;
}

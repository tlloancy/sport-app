import crypto from 'crypto';
import {
  announcePeerId,
  createAccountOnPds,
  resolvePeerFromDID,
  signBlob,
  verifyBlobSignatureAgainstDid,
} from '../lib/atproto';

const PDS_URL = process.env.PDS_URL ?? 'http://localhost:2583';

async function main() {
  const password = 'testpass-step7';

  const accountA = await createAccountOnPds(
    PDS_URL,
    `peer-a-${crypto.randomBytes(3).toString('hex')}.test`,
    password
  );
  const accountB = await createAccountOnPds(
    PDS_URL,
    `peer-b-${crypto.randomBytes(3).toString('hex')}.test`,
    password
  );

  if (!accountA.agent || !accountB.agent) {
    throw new Error('missing agents after account creation');
  }

  await announcePeerId(accountA.agent, 'peer_a_id');
  await announcePeerId(accountB.agent, 'peer_b_id');

  // Third party: no account, only PDS URL + DIDs (no central peer registry).
  const resolvedA = await resolvePeerFromDID(accountA.did, PDS_URL);
  const resolvedB = await resolvePeerFromDID(accountB.did, PDS_URL);

  if (resolvedA !== 'peer_a_id' || resolvedB !== 'peer_b_id') {
    console.error('FAIL: peer_id mismatch', { resolvedA, resolvedB });
    process.exit(1);
  }
  console.log('PASS: peer_id resolved from DID without central server');

  const blobHash = 'video-chunk-manifest-hash-step7';
  const signed = await signBlob(accountA.did, accountA.keypair, blobHash);
  const verified = await verifyBlobSignatureAgainstDid(signed, PDS_URL);
  if (!verified) {
    console.error('FAIL: blob signature not verified against DID public key');
    process.exit(1);
  }
  console.log('PASS: blob signature verified against DID public key');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});

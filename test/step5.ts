import { createLocalIdentity, signBlob, verifyBlobSignature } from '../lib/atproto';

async function main() {
  const { did, keypair } = await createLocalIdentity();
  const blobHash = 'abc123deadbeef'.repeat(4);

  const signed = await signBlob(did, keypair, blobHash);

  // Third-party verifier only has fields from the signed payload (no private key).
  const ok = await verifyBlobSignature(signed);
  if (!ok) {
    console.error('FAIL: signature not verified');
    process.exit(1);
  }

  console.log('PASS: signature verified by third-party verifier');
  console.log(`DID: ${did}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});

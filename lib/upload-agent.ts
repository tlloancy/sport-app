import { AtpAgent } from '@atproto/api';

const PDS_URL = process.env.PDS_URL ?? 'http://localhost:2583';
const UPLOAD_HANDLE = process.env.UPLOAD_HANDLE ?? 'uploader.test';
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD ?? 'upload-test-pass';

/** Dev/test agent — login or create the configured upload account on the local PDS. */
export async function getUploadAgent(): Promise<AtpAgent> {
  const agent = new AtpAgent({ service: PDS_URL });
  try {
    await agent.login({ identifier: UPLOAD_HANDLE, password: UPLOAD_PASSWORD });
    return agent;
  } catch {
    await agent.createAccount({
      handle: UPLOAD_HANDLE,
      password: UPLOAD_PASSWORD,
      email: `${UPLOAD_HANDLE.replace(/[^a-z0-9]/gi, '-')}@localhost.test`,
    });
    return agent;
  }
}

export function pdsUrl(): string {
  return PDS_URL;
}

import { AtpAgent } from '@atproto/api';
import { DEFAULT_PDS_URL, defaultPdsUrls } from '@/lib/atproto';

const PDS_URL = DEFAULT_PDS_URL;
const UPLOAD_HANDLE = process.env.UPLOAD_HANDLE ?? 'uploader.test';
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD ?? 'upload-test-pass';

let cachedAgent: AtpAgent | null = null;

/** Dev/test agent — login once and reuse session across publishes. */
export async function getUploadAgent(): Promise<AtpAgent> {
  if (cachedAgent?.session) {
    return cachedAgent;
  }

  const agent = new AtpAgent({ service: PDS_URL });
  try {
    await agent.login({ identifier: UPLOAD_HANDLE, password: UPLOAD_PASSWORD });
  } catch {
    await agent.createAccount({
      handle: UPLOAD_HANDLE,
      password: UPLOAD_PASSWORD,
      email: `${UPLOAD_HANDLE.replace(/[^a-z0-9]/gi, '-')}@localhost.test`,
    });
  }

  cachedAgent = agent;
  return agent;
}

export function pdsUrl(): string {
  return PDS_URL;
}

export function pdsUrls(): string[] {
  return defaultPdsUrls();
}

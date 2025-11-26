import fs from 'fs';
import os from 'os';
import path from 'path';

export function getPrivateKeyPath(): string {
  const pemContents = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!pemContents) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is not set');
  }

  const pemPath = path.join(os.tmpdir(), 'github-app.pem');
  // Write the PEM to a temp file (overwrites if exists)
  fs.writeFileSync(pemPath, pemContents.replace(/\\n/g, '\n'));
  return pemPath;
}

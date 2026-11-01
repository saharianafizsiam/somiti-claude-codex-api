import { createCipheriv, publicEncrypt, randomBytes, constants } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// Temporary owner-requested migration. Only this old production project can
// produce the bundle. The private key is held exclusively on the owner's PC.
if (process.env.VERCEL_PROJECT_ID === 'prj_pSLnMKpumS29AWtJA5L3uipvgEoU' && process.env.VERCEL_ENV === 'production') {
  const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA6BINdNi9ORbSg/5cpVuk
r4ZOhtn2cE9x025sVhPaTIPLpTpoebjZVuyYq47AAzsTiLd0mWWQNQn/GK0Zl/A5
vpqIuet/3bHWZPr/HAONRnw1BYcpCDX7adFIU+pDjinzoD3wWZRrQzjRXY8simZG
w5ZQxwq5WGyfNmwddfMqoXovDOgE6hvmpRKWxf/IEfK87FG1pzYTMX+nQVGhhwpw
19p/BUAie/ElqfPmO8mSDpXJVHXoHyzoEAdSylJmehKdLLlu9qQdR2RhXEECzp2z
+Vu9WFCx1aabaMIJ56l5yDieZzyeBMIt2ETy2WlwKp+H9oRgPIGB4e4rkq2qcAax
GHO46lQMZMvUjCdfo6TT8sjRSGoe7/hr29NfKcL0NDTiO19rqXoWvWh0emEp297d
zZ+FVQcRm1Kk4lQlccrIgVkXSW4NlQlq4EVhXsWD5hpIhqyt+JLriItUuGDUWjmf
TKHli8hW2nLBu4oEZSXFqZPMDkDSA2AtWs7IOLXXMU9rAgMBAAE=
-----END PUBLIC KEY-----`;
  const names = ['AUTH_SECRET', 'API_KEY_ENCRYPTION_SECRET', 'CRON_SECRET', 'DATABASE_URL'];
  const values = Object.fromEntries(names.map(name => [name, process.env[name] || '']));
  if (names.some(name => !values[name])) throw new Error('Recovery requires all four original settings');
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  const wrapped = publicEncrypt({ key: publicKey, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING }, key);
  mkdirSync('public', { recursive: true });
  writeFileSync('public/migration-sealed-41c72a9b.json', JSON.stringify({ version: 1, key: wrapped.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), body: body.toString('base64') }));
  console.log('Owner recovery bundle encrypted successfully. No plaintext settings logged.');
}

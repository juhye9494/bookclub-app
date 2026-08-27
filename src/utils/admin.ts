export const ADMIN_EMAILS = [
  'xn940@naver.com',
  'ess0317@hankyung.com',
  'parkjh@hankyung.com',
  'lygin729@hankyung.com',
  'mama0707@hankyung.com',
  'pdh0109@hankyung.com',
  'shchoi@hankyung.com',
  'mwd101@hankyung.com',
  'sj.flyme@gmail.com',
  'ehrtjdlwpgh@hankyung.com',
  'hyemink@hankyung.com',
  'ghkim@hankyung.com',
  'chaem@hankyung.com'
];

export function isAdmin(email: string | undefined | null): boolean {
  if (!email || email.trim() === '') return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

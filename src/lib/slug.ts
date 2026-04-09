export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return `Must be between ${SLUG_MIN} and ${SLUG_MAX} characters`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return "Use only lowercase letters, numbers, and hyphens";
  }
  return null; // valid
}

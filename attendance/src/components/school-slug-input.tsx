/**
 * Tells a Server Action which school the form belongs to. It is only a lookup
 * key: the action re-verifies the caller's admin membership for that school.
 */
export function SchoolSlugInput({ slug }: { slug: string }) {
  return <input type="hidden" name="schoolSlug" value={slug} />;
}

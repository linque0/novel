/** Explicit opt-in for an isolated AI acceptance profile; production profiles remain forbidden. */
export function assertAiTestProfile(loc) {
  const isolated = ['preset-experience-verify','booksource-verify'].includes(process.env.AI_TEST_PROFILE)
  const suffix = isolated ? '小说工坊-'+process.env.AI_TEST_PROFILE : '小说工坊-dev'
  if (!String(loc?.defaultDir).endsWith(suffix) ||
      (isolated && (loc.isCustom || loc.current !== loc.defaultDir))) {
    throw new Error('Refusing to touch a non-test or redirected profile')
  }
}

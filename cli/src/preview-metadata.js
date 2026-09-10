export const PREVIEW_METADATA_EXPORTS = ['name', 'group']

export const GROUP_EXPORT = 'group'

export const GROUPS_EXPORT = 'groups'

export const PREVIEW_SKILL_EXPORT = 'impPreviewSkill'

export const isPreviewMetadataExport = (exportName) => PREVIEW_METADATA_EXPORTS.includes(exportName)

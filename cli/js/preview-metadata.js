export const PREVIEW_METADATA_EXPORTS = ['name', 'group', 'description']

export const GROUP_EXPORT = 'group'

export const DESCRIPTION_EXPORT = 'description'

export const GROUPS_EXPORT = 'groups'

export const PREVIEW_SKILL_EXPORT = 'impPreviewSkill'

export const isPreviewMetadataExport = (exportName) => PREVIEW_METADATA_EXPORTS.includes(exportName)

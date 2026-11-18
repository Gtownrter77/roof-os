const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

// EAS bundles from apps/field. Shared GPS helpers live in ../../lib and
// must be watched, or Metro reports "Unable to resolve module".
config.watchFolders = [...new Set([...(config.watchFolders || []), workspaceRoot])]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
const sourceExts = new Set(config.resolver.sourceExts || [])
sourceExts.add('mjs')
config.resolver.sourceExts = [...sourceExts]

module.exports = config

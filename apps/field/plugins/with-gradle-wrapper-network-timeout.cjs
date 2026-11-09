const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

const NETWORK_TIMEOUT_MS = 120_000

module.exports = function withGradleWrapperNetworkTimeout(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const propertiesPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      )
      let properties = await fs.readFile(propertiesPath, 'utf8')
      const timeoutLine = `networkTimeout=${NETWORK_TIMEOUT_MS}`
      if (/^networkTimeout=.*$/m.test(properties)) {
        properties = properties.replace(/^networkTimeout=.*$/m, timeoutLine)
      } else {
        properties = `${properties.trimEnd()}\n${timeoutLine}\n`
      }
      await fs.writeFile(propertiesPath, properties, 'utf8')
      return modConfig
    },
  ])
}

const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

const NETWORK_TIMEOUT_MS = 120_000

function upsertProperty(contents, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key.replaceAll('.', '\\.')}=.*$`, 'm')
  if (pattern.test(contents)) {
    return contents.replace(pattern, line)
  }
  return `${contents.trimEnd()}\n${line}\n`
}

module.exports = function withGradleWrapperNetworkTimeout(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const androidRoot = modConfig.modRequest.platformProjectRoot
      const wrapperPath = path.join(androidRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties')
      const wrapper = await fs.readFile(wrapperPath, 'utf8')
      await fs.writeFile(
        wrapperPath,
        upsertProperty(wrapper, 'networkTimeout', String(NETWORK_TIMEOUT_MS)),
        'utf8',
      )

      const gradlePropertiesPath = path.join(androidRoot, 'gradle.properties')
      let gradleProperties = await fs.readFile(gradlePropertiesPath, 'utf8').catch(() => '')
      gradleProperties = upsertProperty(
        gradleProperties,
        'systemProp.org.gradle.internal.http.connectionTimeout',
        String(NETWORK_TIMEOUT_MS),
      )
      gradleProperties = upsertProperty(
        gradleProperties,
        'systemProp.org.gradle.internal.http.socketTimeout',
        String(NETWORK_TIMEOUT_MS),
      )
      await fs.writeFile(gradlePropertiesPath, gradleProperties, 'utf8')
      return modConfig
    },
  ])
}

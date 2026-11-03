import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'

export const FIELD_THEMES = [
  { id: 'professional', name: 'Professional', eyebrow: 'ALL BUSINESS', accent: '#ef3340', sky: '#eef3f8', horizon: '#dce6ef', ink: '#102033', description: 'Black. Red. White. Your operation, stripped to the essentials.' },
  { id: 'tornado', name: 'Tornado Alley', eyebrow: 'IN THE PATH', accent: '#a3dcad', sky: '#17251f', horizon: '#405c53', ink: '#f4fff6', description: 'A rotating wall cloud. A funnel on the ground. You came to work.' },
  { id: 'storm-command', name: 'Storm Tracker 11', eyebrow: 'COMMAND THE STORM', accent: '#38c9ff', sky: '#06101d', horizon: '#0c2137', ink: '#eff8ff', description: 'The meteorologist. The command center. Your next move.' },
  { id: 'hail', name: 'Hail Core', eyebrow: 'BUILT FOR IMPACT', accent: '#bba5ff', sky: '#171328', horizon: '#34305d', ink: '#f7f2ff', description: 'Ice hits hard. Your crew hits the ground ready.' },
  { id: 'lightning', name: 'Lightning Front', eyebrow: 'CHARGE THE HORIZON', accent: '#73a6ff', sky: '#071329', horizon: '#343a65', ink: '#f0f5ff', description: 'A towering shelf cloud. Electric skies. No small entrance.' },
  { id: 'after-storm', name: 'After the Storm', eyebrow: 'LEAVE IT STRONGER', accent: '#ffbd76', sky: '#253b53', horizon: '#c77d50', ink: '#201812', description: 'Storm rolls out. Crew rolls in. The roof stands tall.' },
] as const

export type FieldThemeId = typeof FIELD_THEMES[number]['id']
export const FIELD_THEME_STORAGE_KEY = 'roof_os_field_theme'

export function fieldTheme(id: FieldThemeId) {
  return FIELD_THEMES.find((theme) => theme.id === id) ?? FIELD_THEMES[2]
}

export function isFieldTheme(value: string | null | undefined): value is FieldThemeId {
  return FIELD_THEMES.some((theme) => theme.id === value)
}

type Props = { theme: FieldThemeId; compact?: boolean }

export function FieldThemeBackground({ theme, compact = false }: Props) {
  const palette = fieldTheme(theme)
  const drift = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (theme === 'professional') return
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [drift, theme])

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] })
  const rotate = drift.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] })
  const isDark = theme !== 'professional' && theme !== 'after-storm'

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: palette.sky }]}>
      <View style={[styles.horizon, { backgroundColor: palette.horizon, opacity: isDark ? 0.9 : 0.72 }]} />
      {theme === 'professional' ? (
        <View style={styles.professionalMark}>
          <View style={[styles.roofLine, { borderColor: palette.accent }]} />
          <View style={[styles.roofLineSmall, { borderColor: palette.accent }]} />
        </View>
      ) : (
        <>
          <Animated.View style={[styles.cloud, styles.cloudLarge, { backgroundColor: isDark ? '#0d1828' : '#fff5df', opacity: isDark ? 0.7 : 0.42, transform: [{ translateX }, { rotate }] }]} />
          <Animated.View style={[styles.cloud, styles.cloudSmall, { backgroundColor: isDark ? '#24384a' : '#fff8ed', opacity: isDark ? 0.55 : 0.36, transform: [{ translateX: Animated.multiply(translateX, 0.55) }] }]} />
          {theme === 'tornado' ? <View style={[styles.funnel, { borderColor: palette.accent }]} /> : null}
          {theme === 'storm-command' ? <RadarMarks color={palette.accent} /> : null}
          {theme === 'hail' ? <HailMarks color={palette.accent} /> : null}
          {theme === 'lightning' ? <LightningMark color={palette.accent} /> : null}
          {theme === 'after-storm' ? <View style={[styles.sun, { backgroundColor: palette.accent }]} /> : null}
        </>
      )}
      {!compact ? <View style={styles.tint} /> : null}
    </View>
  )
}

function RadarMarks({ color }: { color: string }) {
  return <View style={styles.radar}><View style={[styles.radarCircle, { borderColor: color }]} /><View style={[styles.radarCross, { backgroundColor: color }]} /><Text style={[styles.radarLabel, { color }]}>STORM TRACKER 11</Text></View>
}

function HailMarks({ color }: { color: string }) {
  return <View style={styles.hailMarks}>{[0, 1, 2, 3, 4, 5].map((item) => <View key={item} style={[styles.hail, { backgroundColor: color, left: `${12 + item * 15}%`, top: `${12 + (item % 3) * 15}%` }]} />)}</View>
}

function LightningMark({ color }: { color: string }) {
  return <View style={styles.lightning}><View style={[styles.bolt, { borderColor: color }]} /><View style={[styles.boltShort, { borderColor: color }]} /></View>
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  horizon: { position: 'absolute', left: -40, right: -40, bottom: 0, height: '42%', borderTopLeftRadius: 160, borderTopRightRadius: 160 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: '#ffffff', opacity: 0.1 },
  cloud: { position: 'absolute', borderRadius: 999 },
  cloudLarge: { width: 420, height: 170, top: 54, left: -80 },
  cloudSmall: { width: 300, height: 120, top: 170, right: -90 },
  professionalMark: { position: 'absolute', right: -50, bottom: 82, width: 270, height: 180, opacity: 0.16 },
  roofLine: { position: 'absolute', width: 245, height: 150, borderTopWidth: 4, transform: [{ rotate: '37deg' }] },
  roofLineSmall: { position: 'absolute', width: 190, height: 130, borderTopWidth: 3, top: 25, left: 35, transform: [{ rotate: '37deg' }] },
  funnel: { position: 'absolute', width: 230, height: 300, top: 100, left: '32%', borderLeftWidth: 28, borderRightWidth: 28, borderBottomWidth: 30, borderRadius: 120, opacity: 0.22, transform: [{ rotate: '5deg' }] },
  radar: { position: 'absolute', right: 18, top: 54, width: 150, height: 150, alignItems: 'center', justifyContent: 'center', opacity: 0.24 },
  radarCircle: { width: 150, height: 150, borderWidth: 2, borderRadius: 75 },
  radarCross: { position: 'absolute', width: 1, height: 132 },
  radarLabel: { position: 'absolute', top: -22, right: 0, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  hailMarks: { ...StyleSheet.absoluteFill },
  hail: { position: 'absolute', width: 12, height: 18, borderRadius: 8, opacity: 0.35, transform: [{ rotate: '28deg' }] },
  lightning: { position: 'absolute', right: 36, top: 60, width: 110, height: 170, opacity: 0.45 },
  bolt: { position: 'absolute', width: 48, height: 110, borderLeftWidth: 5, borderBottomWidth: 5, transform: [{ skewX: '-20deg' }, { rotate: '-24deg' }] },
  boltShort: { position: 'absolute', left: 54, top: 50, width: 34, height: 86, borderLeftWidth: 4, borderBottomWidth: 4, transform: [{ skewX: '-20deg' }, { rotate: '-24deg' }] },
  sun: { position: 'absolute', right: -90, top: 80, width: 300, height: 300, borderRadius: 150, opacity: 0.35 },
})

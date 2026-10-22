import { Pressable, Text, View, Modal, ScrollView, Alert } from 'react-native'
import { useState } from 'react'
import { draftGoldenReport, draftEstimate, type PhotoAiResult } from './batch1'
import { draftDamageSeverity, draftPhotoQuality, draftVoiceMeasurement, draftCompleteness, draftDailySummary } from './batch26to50'

type Props = {
  photoCount: number
  notes: string
  squares: number
  pitch: number
  hasPriceBook: boolean
  laborRate: number
  materialRate: number
  minMargin: number
}

export function DraftActions({ photoCount, notes, squares, pitch, hasPriceBook, laborRate, materialRate, minMargin }: Props) {
  const [modal, setModal] = useState<string | null>(null)
  const [content, setContent] = useState('')

  function showReport() {
    const photos: PhotoAiResult[] = Array.from({ length: Math.max(1, photoCount) }, () => ({
      damageScore: 0.4,
      pitchEstimate: pitch || 6,
      suggestedAlbum: 'damage',
      suggestedCaption: null,
      condition: 'fair',
      observations: ['Draft observation — verify on site'],
    }))
    const draft = draftGoldenReport({ photos, notes, measurements: { squares, pitch } })
    setContent(JSON.stringify(draft, null, 2))
    setModal('report')
  }

  function showEstimate() {
    if (!hasPriceBook) return
    const draft = draftEstimate({
      squares: squares || 20,
      pitch: pitch || 6,
      priceBook: { laborPerSquare: laborRate, materialPerSquare: materialRate, minMargin },
    })
    setContent(JSON.stringify(draft, null, 2))
    setModal('estimate')
  }

  function copyDraftLink() {
    const text = 'DRAFT — not active yet: https://roof-os.example/share/draft-' + Date.now()
    Alert.alert('Draft link', text)
  }

  function showSeverity() {
    const d = draftDamageSeverity(photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('severity')
  }

  function showQuality() {
    const d = draftPhotoQuality(0.2)
    setContent(JSON.stringify(d, null, 2))
    setModal('quality')
  }

  function showVoice() {
    const d = draftVoiceMeasurement(notes || 'twenty squares six twelve pitch')
    setContent(JSON.stringify(d, null, 2))
    setModal('voice')
  }

  function showComplete() {
    const d = draftCompleteness(photoCount > 0, squares > 0, notes.length > 0)
    setContent(JSON.stringify(d, null, 2))
    setModal('complete')
  }

  function showDaily() {
    const d = draftDailySummary(1, photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('daily')
  }

  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Pressable onPress={showReport} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Draft report</Text>
      </Pressable>
      <Pressable
        onPress={showEstimate}
        disabled={!hasPriceBook}
        style={{ backgroundColor: hasPriceBook ? '#138a5b' : '#607086', padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          {hasPriceBook ? 'Draft estimate' : 'Estimate — needs price book'}
        </Text>
      </Pressable>
      <Pressable onPress={copyDraftLink} style={{ backgroundColor: '#102033', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Copy draft link</Text>
      </Pressable>
      <Pressable onPress={showSeverity} style={{ backgroundColor: '#b42318', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Damage severity</Text>
      </Pressable>
      <Pressable onPress={showQuality} style={{ backgroundColor: '#607086', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Photo quality</Text>
      </Pressable>
      <Pressable onPress={showVoice} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Voice measurements</Text>
      </Pressable>
      <Pressable onPress={showComplete} style={{ backgroundColor: '#138a5b', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Completeness check</Text>
      </Pressable>
      <Pressable onPress={showDaily} style={{ backgroundColor: '#102033', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Daily summary</Text>
      </Pressable>

      <Modal visible={!!modal} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            {modal === 'report' ? 'Draft Report' : modal === 'estimate' ? 'Draft Estimate' : modal === 'severity' ? 'Damage Severity' : modal === 'quality' ? 'Photo Quality' : modal === 'voice' ? 'Voice Measurements' : modal === 'complete' ? 'Completeness' : 'Daily Summary'}
          </Text>
          <ScrollView>
            <Text selectable>{content}</Text>
          </ScrollView>
          <Text style={{ marginTop: 12, color: '#607086' }}>Technician must approve on desktop</Text>
          <Pressable onPress={() => setModal(null)} style={{ marginTop: 16, padding: 12, backgroundColor: '#1769e0', borderRadius: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

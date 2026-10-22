import { Pressable, Text, View, Modal, ScrollView, Alert } from 'react-native'
import { useState } from 'react'
import { draftGoldenReport, draftEstimate, type PhotoAiResult } from './batch1'
import { draftMissingShingles, draftGranuleLoss, draftStructuredNote, draftJobComplete, draftAuditEvent, draftAgentProposal } from './batch76to100'
import { draftHailImpacts, draftWindUplift, draftPhotoAlbumGap, draftOfficeHandoff, draftCustomerText } from './batch101to125'
import { draftMaterialMatch, draftTearOff, draftDuration, draftSafetyHarness, draftReviewRequest } from './batch126to150'

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

  function showMissing() {
    const d = draftMissingShingles(photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('missing')
  }

  function showGranule() {
    const d = draftGranuleLoss(photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('granule')
  }

  function showStructured() {
    const d = draftStructuredNote(notes || 'note')
    setContent(JSON.stringify(d, null, 2))
    setModal('structured')
  }

  function showJobComplete() {
    const d = draftJobComplete(photoCount > 0, squares > 0)
    setContent(JSON.stringify(d, null, 2))
    setModal('jobcomplete')
  }

  function showAudit() {
    const d = draftAuditEvent('draft_viewed')
    setContent(JSON.stringify(d, null, 2))
    setModal('audit')
  }

  function showAgent() {
    const d = draftAgentProposal(photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('agent')
  }

  function showHail() {
    const d = draftHailImpacts(photoCount)
    setContent(JSON.stringify(d, null, 2))
    setModal('hail')
  }

  function showWind() {
    const d = draftWindUplift(pitch)
    setContent(JSON.stringify(d, null, 2))
    setModal('wind')
  }

  function showAlbumGap() {
    const d = draftPhotoAlbumGap(['damage'])
    setContent(JSON.stringify(d, null, 2))
    setModal('album')
  }

  function showHandoff() {
    const d = draftOfficeHandoff(photoCount > 0, notes.length > 0)
    setContent(JSON.stringify(d, null, 2))
    setModal('handoff')
  }

  function showCustomer() {
    const d = draftCustomerText('Customer')
    setContent(JSON.stringify(d, null, 2))
    setModal('customer')
  }

  function showMaterial() {
    const d = draftMaterialMatch(notes)
    setContent(JSON.stringify(d, null, 2))
    setModal('material')
  }

  function showTearOff() {
    const d = draftTearOff(notes)
    setContent(JSON.stringify(d, null, 2))
    setModal('tearoff')
  }

  function showDuration() {
    const d = draftDuration(squares)
    setContent(JSON.stringify(d, null, 2))
    setModal('duration')
  }

  function showHarness() {
    const d = draftSafetyHarness(pitch)
    setContent(JSON.stringify(d, null, 2))
    setModal('harness')
  }

  function showReview() {
    const d = draftReviewRequest('Customer')
    setContent(JSON.stringify(d, null, 2))
    setModal('review')
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
      <Pressable onPress={showMissing} style={{ backgroundColor: '#b42318', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Missing shingles</Text>
      </Pressable>
      <Pressable onPress={showGranule} style={{ backgroundColor: '#607086', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Granule loss</Text>
      </Pressable>
      <Pressable onPress={showStructured} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Structured notes</Text>
      </Pressable>
      <Pressable onPress={showJobComplete} style={{ backgroundColor: '#138a5b', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Job complete check</Text>
      </Pressable>
      <Pressable onPress={showAudit} style={{ backgroundColor: '#102033', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Audit event</Text>
      </Pressable>
      <Pressable onPress={showAgent} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Next action</Text>
      </Pressable>
      <Pressable onPress={showHail} style={{ backgroundColor: '#b42318', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Hail impacts</Text>
      </Pressable>
      <Pressable onPress={showWind} style={{ backgroundColor: '#607086', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Wind uplift</Text>
      </Pressable>
      <Pressable onPress={showAlbumGap} style={{ backgroundColor: '#138a5b', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Album gaps</Text>
      </Pressable>
      <Pressable onPress={showHandoff} style={{ backgroundColor: '#102033', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Office handoff</Text>
      </Pressable>
      <Pressable onPress={showCustomer} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Customer text</Text>
      </Pressable>
      <Pressable onPress={showMaterial} style={{ backgroundColor: '#138a5b', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Material match</Text>
      </Pressable>
      <Pressable onPress={showTearOff} style={{ backgroundColor: '#b42318', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Tear-off</Text>
      </Pressable>
      <Pressable onPress={showDuration} style={{ backgroundColor: '#607086', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Duration</Text>
      </Pressable>
      <Pressable onPress={showHarness} style={{ backgroundColor: '#102033', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Safety harness</Text>
      </Pressable>
      <Pressable onPress={showReview} style={{ backgroundColor: '#1769e0', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Review request</Text>
      </Pressable>

      <Modal visible={!!modal} animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            {modal === 'report' ? 'Draft Report' : modal === 'estimate' ? 'Draft Estimate' : modal === 'missing' ? 'Missing Shingles' : modal === 'granule' ? 'Granule Loss' : modal === 'structured' ? 'Structured Notes' : modal === 'jobcomplete' ? 'Job Complete' : modal === 'audit' ? 'Audit Event' : 'Next Action'}
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

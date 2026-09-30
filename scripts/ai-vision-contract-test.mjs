import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const contractSource = readFileSync(new URL("../lib/ai/roof-contract.ts", import.meta.url), "utf8")
const contractCode = ts.transpileModule(contractSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const contract = await import(`data:text/javascript;base64,${Buffer.from(contractCode).toString("base64")}`)
const {
  validateRoofAIObservationPacket,
  AIContractValidationError,
  ROOF_AI_CONTRACT_VERSION,
  ROOF_AI_DISCLAIMER,
} = contract

function makeBasePacket() {
  return {
    contract_version: ROOF_AI_CONTRACT_VERSION,
    analyzed_at: new Date().toISOString(),
    model_id: "gemini-2.5-flash",
    measurement_status: "unverified_ai_observation",
    authority_disclaimer: ROOF_AI_DISCLAIMER,
    image_audit: [
      {
        photo_index: 0,
        roof_visibility: "full",
        quality: "clear",
        perspective: "roof_level",
        obstructions: ["none"],
        is_duplicate_or_near_duplicate: false,
        usable_for_analysis: true,
        audit_notes: "Clear south slope overview"
      },
      {
        photo_index: 1,
        roof_visibility: "partial",
        quality: "clear",
        perspective: "ladder_level",
        obstructions: ["trees_foliage"],
        is_duplicate_or_near_duplicate: false,
        usable_for_analysis: true,
        audit_notes: "North slope with slight tree overhang"
      }
    ],
    roof_classification: {
      roof_style: "gable",
      primary_material: "architectural_shingle",
      secondary_material: null,
      apparent_condition: "fair",
      complexity_class: "simple",
      confidence: "high"
    },
    facet_observations: [
      {
        facet_id: "facet_1",
        label: "South Front Slope",
        facet_type: "main_pitch",
        orientation: "south",
        pitch_class: "standard",
        apparent_pitch: "approximately 5/12 to 7/12 visually",
        confidence: "high",
        measurement_status: "estimated",
        source_photo_indices: [0],
        notes: "Main front elevation"
      },
      {
        facet_id: "facet_2",
        label: "North Rear Slope",
        facet_type: "main_pitch",
        orientation: "north",
        pitch_class: "standard",
        apparent_pitch: "approximately 5/12 to 7/12 visually",
        confidence: "medium",
        measurement_status: "estimated",
        source_photo_indices: [1],
        notes: "Main rear elevation"
      }
    ],
    edge_observations: [
      {
        edge_id: "edge_1",
        edge_type: "ridge",
        adjacent_facet_ids: ["facet_1", "facet_2"],
        visible_condition: "intact",
        confidence: "high",
        source_photo_indices: [0],
        notes: "Central ridge line"
      }
    ],
    penetration_observations: [
      {
        penetration_id: "pen_1",
        penetration_type: "plumbing_vent_pipe",
        associated_facet_id: "facet_1",
        visible_condition: "good",
        confidence: "high",
        source_photo_indices: [0],
        notes: "Standard lead plumbing boot"
      }
    ],
    damage_observations: [
      {
        damage_id: "dmg_1",
        observation_type: "observed",
        category: "creased_shingles",
        severity: "moderate",
        location_description: "Upper left quadrant of Facet 1",
        associated_facet_id: "facet_1",
        confidence: "medium",
        source_photo_indices: [0],
        notes: "Wind-creased tabs visible in foreground"
      }
    ],
    summary: "Visual analysis of two-slope residential gable roof with localized wind creasing.",
    warnings: ["Tree foliage partially occludes north eave edge."]
  }
}

console.log("Running AI Vision Contract Tests...")

// Test 1: Valid complete packet passes
{
  const packet = makeBasePacket()
  const validated = validateRoofAIObservationPacket(packet, 2)
  assert.equal(validated.contract_version, "1.0.0")
  assert.equal(validated.facet_observations.length, 2)
  console.log("  ✓ Test 1: Valid complete packet passed")
}

// Test 2: Unknown root property rejected
{
  const packet = makeBasePacket()
  packet.unexpected_root_key = "should_fail"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes('Unknown property "unexpected_root_key"')
  )
  console.log("  ✓ Test 2: Unknown root property rejected")
}

// Test 3: Unknown nested property in facet rejected
{
  const packet = makeBasePacket()
  packet.facet_observations[0].hallucinated_field = 123
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes('Unknown property "hallucinated_field"')
  )
  console.log("  ✓ Test 3: Unknown nested property rejected")
}

// Test 4: Forbidden metric key rejected deep in object tree
{
  const packet = makeBasePacket()
  packet.damage_observations[0].roof_squares = 32
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes('Forbidden metric/commercial key "roof_squares"')
  )
  console.log("  ✓ Test 4: Forbidden metric key (deep) rejected")
}

// Test 5: Malicious/authoritative pitch text rejected
{
  const packet = makeBasePacket()
  packet.facet_observations[0].apparent_pitch = "verified pitch = 6/12"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("Authoritative pitch claims forbidden")
  )
  console.log("  ✓ Test 5: Authoritative pitch text rejected")
}

// Test 6: Invalid enum value rejected
{
  const packet = makeBasePacket()
  packet.roof_classification.roof_style = "hyperbolic_paraboloid"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("Expected one of")
  )
  console.log("  ✓ Test 6: Invalid enum value rejected")
}

// Test 7: Photo index out of bounds rejected
{
  const packet = makeBasePacket()
  packet.facet_observations[0].source_photo_indices = [99]
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("out of bounds for 2 submitted photos")
  )
  console.log("  ✓ Test 7: Out-of-bounds photo index rejected")
}

// Test 8: Orphaned facet reference rejected
{
  const packet = makeBasePacket()
  packet.damage_observations[0].associated_facet_id = "facet_nonexistent"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes('Referenced facet_id "facet_nonexistent" is not declared')
  )
  console.log("  ✓ Test 8: Orphaned facet reference rejected")
}

// Test 9: Empty required source_photo_indices in damage rejected
{
  const packet = makeBasePacket()
  packet.damage_observations[0].source_photo_indices = []
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("Damage observation must reference at least one source photo")
  )
  console.log("  ✓ Test 9: Empty required damage photo indices rejected")
}

// Test 10: Invalid nullable value rejected
{
  const packet = makeBasePacket()
  packet.roof_classification.secondary_material = "invalid_material_type"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("Expected one of")
  )
  console.log("  ✓ Test 10: Invalid nullable value rejected")
}

// Test 11: Prohibited commercial / claim term rejected
{
  const packet = makeBasePacket()
  packet.damage_observations[0].notes = "Inspection confirms coverage approved for full replacement"
  assert.throws(
    () => validateRoofAIObservationPacket(packet, 2),
    (err) => err instanceof AIContractValidationError && err.message.includes("Prohibited commercial/claim terms in notes")
  )
  console.log("  ✓ Test 11: Prohibited claim term rejected")
}

console.log("ai-vision-contract-test: ALL 11 TESTS PASSED")

const env = require('../config/env');

let anthropic = null;
if (env.anthropic.apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });
}

// Checked BEFORE any AI call — a keyword hit short-circuits straight to
// an emergency-services message. This is a deliberate safety layer that
// doesn't depend on the model behaving correctly; it runs regardless of
// what the AI would have said.
const EMERGENCY_KEYWORDS = [
  'can\'t breathe', 'cant breathe', 'not breathing', 'unconscious', 'unresponsive',
  'chest pain', 'severe bleeding', 'uncontrolled bleeding', 'heart attack', 'stroke',
  'seizure', 'overdose', 'suicidal', 'suicide',
];

function containsEmergencyKeyword(text) {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

const EMERGENCY_RESPONSE = {
  emergency: true,
  message:
    'This sounds like it may be a medical emergency. Please call your local emergency ' +
    'number or go to the nearest emergency room immediately — do not wait for a response ' +
    'through this platform.',
};

/**
 * Explains a compatibility score in plain English. Deliberately framed
 * around the organ-matching refinement from Milestone 4: a score is a
 * candidate-shortlist signal, never confirmation that a match will
 * proceed — the explanation must not imply otherwise, especially for
 * anything requiring crossmatch review.
 */
async function explainMatch(context) {
  const { organType, donorBloodType, recipientBloodType, score, sameCityOrState, requiresCrossmatch } = context;

  if (!anthropic) {
    return mockExplanation(context);
  }

  const system = `You explain donor-recipient compatibility scores on a blood/organ donation
platform, to non-medical readers (patients, donors, or coordinators). You are not a doctor
and must never give medical advice beyond explaining the scoring factors you're given.
${requiresCrossmatch
    ? 'This is an organ match: you MUST make clear this is a preliminary algorithmic suggestion only, and that full medical evaluation (tissue typing, a crossmatch lab test) is required before anything is confirmed. Never say the match is final or guaranteed.'
    : 'This is a blood match: blood type compatibility is close to deterministic, so you can describe it more directly, but still note that a hospital confirms it before donation.'}
Keep the explanation under 80 words, warm but factual, no medical jargon without explaining it.`;

  const user = `Explain this compatibility score in plain English:
- Organ/tissue type: ${organType}
- Donor blood type: ${donorBloodType}, Recipient blood type: ${recipientBloodType}
- Location match: ${sameCityOrState ? 'same city or state' : 'different region'}
- Compatibility score: ${score}%`;

  try {
    const response = await anthropic.messages.create({
      model: env.anthropic.model,
      max_tokens: 250,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = response.content.find((b) => b.type === 'text')?.text || '';
    return { explanation: text.trim(), mock: false };
  } catch (err) {
    console.error('AI explainMatch error:', err.message);
    return mockExplanation(context);
  }
}

function mockExplanation({ organType, score, requiresCrossmatch }) {
  const base = `This ${organType.toLowerCase()} candidate scored ${score}% based on blood type compatibility, organ match, and location.`;
  const caveat = requiresCrossmatch
    ? ' This is a preliminary suggestion only — full medical evaluation (tissue typing and a crossmatch test) is required before anything is confirmed.'
    : ' A hospital will confirm compatibility before donation proceeds.';
  return { explanation: base + caveat, mock: true };
}

/**
 * Helps a recipient describe their situation and maps it to intake
 * categories (organ type, urgency) — advisory only. Never diagnoses,
 * never recommends treatment, and always defers final judgment to the
 * hospital's medical team. The emergency-keyword check above runs
 * before this is ever called.
 */
async function triageAssist(description) {
  if (containsEmergencyKeyword(description)) {
    return EMERGENCY_RESPONSE;
  }

  if (!anthropic) {
    return mockTriage(description);
  }

  const system = `You are an intake-form assistant for a donation-matching platform. You help
patients or their families describe their situation in a way that maps to intake categories.
You are NOT a medical professional. You must NEVER diagnose a condition, recommend
treatments or medications, or give clinical advice of any kind.
Based on the user's description, suggest:
1. Which category best fits, from exactly this list: Blood, Kidney, Liver, Heart, Lungs, Pancreas, Cornea, Bone Marrow.
2. A starting urgency level from exactly: low, medium, high, critical — based only on how
   the person describes their situation, as a rough starting point.
3. A one-sentence, plain-English rationale for your suggestion.
Always end with a clear statement that a hospital's medical team makes the final
determination and that they should share this with their doctor.
Respond ONLY with JSON in this exact shape, no other text:
{"suggested_organ": "...", "suggested_urgency": "...", "rationale": "...", "safety_note": "..."}`;

  try {
    const response = await anthropic.messages.create({
      model: env.anthropic.model,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: description }],
    });
    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text);
    return { ...parsed, emergency: false, mock: false };
  } catch (err) {
    console.error('AI triageAssist error:', err.message);
    return mockTriage(description);
  }
}

function mockTriage(description) {
  return {
    emergency: false,
    suggested_organ: 'Blood',
    suggested_urgency: 'medium',
    rationale: 'Mock response (no ANTHROPIC_API_KEY configured) — this is a placeholder, not a real assessment.',
    safety_note: 'A hospital\'s medical team will make the final determination. Please also share your situation with your doctor.',
    mock: true,
  };
}

module.exports = { explainMatch, triageAssist, containsEmergencyKeyword };

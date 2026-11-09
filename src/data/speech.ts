import type { SpeechTable } from './schema';

/**
 * What the commander shouts in a speech bubble when the player gives an order (text only, no voice).
 * The sim's 'speech' event carries a line seed; pick SPEECH[faction][order][seed % length].
 * Lines are original and short enough for a phone-sized bubble. New nations add their own block.
 */
export const SPEECH: SpeechTable = {
  british: {
    fallBack: [
      'Back to the HQ, lads!',
      'Fall back! Smartly now!',
      'Pull back, regroup!',
      'Back we go, chaps!',
      'Withdraw! Keep your heads down!',
    ],
    hold: [
      'Hold here, steady!',
      'Dig in and hold fast!',
      'Nobody moves. Hold!',
      'Steady, lads. Hold the line!',
      'Keep your heads. Hold!',
    ],
    advance: [
      'Forward, lads!',
      'Up and at them!',
      'Advance! Follow me!',
      'Come on, push on!',
      'Over we go, boys!',
    ],
  },
  german: {
    fallBack: [
      'Zurück! Back to the bunker!',
      'Fall back, quickly!',
      'Rückzug! Regroup!',
      'Pull back, men!',
      'Back, back! Take cover!',
    ],
    hold: [
      'Halten! Hold here!',
      'Hold the line!',
      'Stay down and hold!',
      'Nobody retreats. Hold!',
      'Stellung halten!',
    ],
    advance: [
      'Vorwärts! Forward!',
      'Attack! Follow me!',
      'Los, los! Push on!',
      'Forward, men!',
      'Angriff! Move up!',
    ],
  },
  // docs/campaigns/NATIONS.md section 3 (in English, like the British lines).
  soviet: {
    fallBack: [
      'Back to the dugouts, move!',
      'Pull back, carry the wounded!',
      'Fall back and regroup!',
      'Back! We hit them again tonight.',
    ],
    hold: [
      'Dig in and hold!',
      'This line is ours. Keep it.',
      'Let them come close. Fire on my word.',
      'Nobody moves back from here.',
    ],
    advance: [
      'Forward, comrades!',
      'Urra! After me!',
      'Up and at them, keep moving!',
      'Into them, for the Motherland!',
    ],
  },
};

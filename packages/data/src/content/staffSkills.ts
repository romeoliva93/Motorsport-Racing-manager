/** Competenze per ruolo dello staff (TECH_TEAM.md §3.2). Chiavi stabili usate da briefing e simulazione. */
import type { StaffMember, StaffRole } from '../schema/people.ts';

const TRACK_ENGINEER = [
  'telemetryAnalysis',
  'feedbackInterpretation',
  'diagnosis',
  'setupKnowledge',
  'strategy',
  'tyreKnowledge',
  'weatherAdaptation',
  'riderCommunication',
  'pressureHandling',
  'problemSolving',
  'learning',
];
const CREW_CHIEF = [
  'mechanicalKnowledge',
  'bikePreparation',
  'suspensionSetup',
  'chassisSetup',
  'feedbackInterpretation',
  'mechanicsCoordination',
  'timeManagement',
  'operationalReliability',
  'precision',
  'problemSolving',
];
const COMMON = ['problemSolving', 'learning', 'teamwork'];

export const STAFF_SKILLS: Partial<Record<StaffRole, string[]>> = {
  trackEngineer: TRACK_ENGINEER,
  crewChief: CREW_CHIEF,
  technicalDirector: [
    'technicalVision',
    'projectManagement',
    'leadership',
    'resourceAllocation',
    'regulationKnowledge',
    'staffAssessment',
  ],
  engineEngineer: [
    'enginePerformance',
    'engineReliability',
    'fuelEfficiency',
    'thermalManagement',
    ...COMMON,
  ],
  electronicsEngineer: [
    'engineMapping',
    'tractionControl',
    'engineBraking',
    'energyStrategy',
    'sensorIntegration',
    ...COMMON,
  ],
  chassisEngineer: ['chassisDesign', 'stiffnessTuning', 'geometry', 'materials', ...COMMON],
  aeroEngineer: ['aeroDesign', 'downforceEfficiency', 'cooling', 'cfd', ...COMMON],
  telemetryAnalyst: ['telemetryAnalysis', 'dataQuality', 'comparisons', 'reporting', ...COMMON],
  strategyChief: [
    'raceStrategy',
    'tyreKnowledge',
    'weatherReading',
    'regulationKnowledge',
    'pressureHandling',
  ],
  mechanic: ['mechanicalSkill', 'speed', 'precision', 'teamwork'],
  sportingDirector: ['negotiation', 'riderManagement', 'regulationKnowledge', 'mediaHandling'],
  physio: ['rehabilitation', 'injuryPrevention', 'fitnessTraining'],
  doctor: ['diagnosis', 'traumaCare', 'rehabilitation'],
  talentScout: ['talentEvaluation', 'networking', 'youthKnowledge'],
};

export const STAFF_SPECIALIZATION: Partial<Record<StaffRole, StaffMember['specialization']>> = {
  trackEngineer: 'trackside',
  crewChief: 'mechanics',
  technicalDirector: 'management',
  engineEngineer: 'engine',
  electronicsEngineer: 'electronics',
  chassisEngineer: 'chassis',
  aeroEngineer: 'aero',
  telemetryAnalyst: 'telemetry',
  strategyChief: 'trackside',
  mechanic: 'mechanics',
  sportingDirector: 'management',
  physio: 'medical',
  doctor: 'medical',
  talentScout: 'management',
};

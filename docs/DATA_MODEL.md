# Modello dati

> Stato: **PROPOSTA**. Le interfacce sono indicative e verranno tradotte in tipi TypeScript in
> `packages/data/schema` durante la Fase 1.

## 1. Convenzioni

- **ID** stringhe con prefisso e progressivo: `rdr_000123` (pilota), `stf_…` (personale),
  `tem_…` (squadra), `mfr_…` (costruttore), `cir_…` (circuito), `ctr_…` (contratto)…
- **Date di gioco**: interi "giorni dal 1° gennaio dell'anno 0 della carriera" (`GameDay`),
  convertiti in data per la UI. Evita fusi orari e problemi di serializzazione.
- **Denaro**: interi in unità intere della valuta di gioco ("crediti", simbolo `₡`), mai float.
- **Attributi**: interi 1–100 visibili; internamente float 0–1 per la simulazione.
  Gli attributi "nascosti" (potenziale reale, ideale di assetto) non sono mai inviati alla UI
  senza passare dal filtro di conoscenza dello scouting.
- **Tabelle**: `GameState.tables.<nome>: Record<Id, Entity>`; le relazioni usano ID, mai oggetti annidati.
- **Storico**: le entità correnti hanno solo lo stato attuale; i cambiamenti significativi
  generano eventi e righe in tabelle di storico/archivio.

## 2. Diagramma (sintesi)

```
Federation ─┬─ Regulation(season, category) ── RegulationProposal ── Vote
            └─ Category ── Season ── Round(Event) ── Session ── SessionResult
                               │           └─ Circuit ── TrackLayout
                               └─ Standing (riders / teams / constructors)

Manufacturer ─ supplies ─► Team ◄─ Contract ─► Person (Rider | StaffMember)
                           │  ├─ StaffAssignment (pilota ↔ capotecnico/ingegnere) ─ RiderStaffBond
                           │  ├─ Bike A / Bike B per pilota ─ SetupSheet ─ SetupLibraryEntry
                           │  └─ Briefing ─ RiderFeedback / StaffHypothesis / SetupProposal / ABComparison
     │                     │  ├─ Facility[]        │
     │                     │  ├─ Bike ─ Component[] ─ ComponentDesign ◄─ RnDProject
     │                     │  ├─ FinanceAccount ─ Transaction[] / Loan[]
     │                     │  ├─ SponsorDeal ─ Sponsor
     │                     │  └─ Academy ─ AcademyRider / Instructor
     └─ Supplier (gomme, carburante, elettronica)

Person ─ Relationship (compatibilità, rivalità, fedeltà) ─ Person/Team
Event log ─► NewsItem / Rumour / PressConference ; Stats ; Records ; SeasonArchive
```

## 3. Entità principali

### Mondo e competizione

```ts
GameMeta      { saveName, seed, schemaVersion, currentDay, playerTeamId, difficulty,
                options: { units, simDetail, autosave } }
Federation    { id, name, acronym, presidentId, politicalBalance }
Category      { id, tier: 'lightweight'|'intermediate'|'premier'|'feeder', name,
                engineRules, ageLimits, maxGrid }
Regulation    { id, categoryId, season, points: number[], sprintPoints: number[],
                weekendFormat: SessionSpec[], engineAllocation, tyreAllocation,
                minWeight, fuelCapacity, techLimits, devFreezes, concessions,
                radioPolicy: 'none'|'dashboard'|'full', penaltiesTable, budgetCap?,
                // revisione Fase 0 (REGULATIONS.md)
                bikesPerRider: 1|2, flagToFlag: boolean, testBikesPerTeam, rebuildAllowedBetweenSessions,
                riderAge: { min, max, rookieMax? }, licenseRequired,
                substitution: { allowed: 'yes'|'organizerReserveOnly'|'no', vacancyAllowed: boolean,
                                vacancyPenalty?: Penalty, participationFeeReductionPerRound?: number,
                                entryDeadline: { weekday, hour }, testerLicenseWaiverKm? },
                inSeasonTests: { everyRounds?: number, sessions?: number } }
RegulationProposal { id, proposedBy, change, voteDeadline, votes: Record<Id,'yes'|'no'|'abstain'>, status }
Season        { id, year, categoryId, roundIds[], status, championRiderId?, championTeamId? }
Round         { id, seasonId, circuitId, startDay, sessionIds[], pressConferenceId? }
SessionSpec   { type: 'FP'|'PR'|'Q1'|'Q2'|'SPRINT'|'WUP'|'RACE', duration|laps, rules }
Session       { id, roundId, spec, weatherTimeline, status, resultId?, seed }
SessionResult { id, sessionId, rows: { riderId, position, time, gap, laps, bestLap,
                status: 'finished'|'dnf'|'dns'|'dsq', points, penalties[] }[] }
Standing      { seasonId, kind: 'rider'|'team'|'constructor', rows: { refId, points, wins, podiums }[] }
Circuit       { id, name, country, length, layoutId, abrasiveness, overtakingIndex,
                climate: { tempProfile, rainProbabilityByMonth, wind }, characteristics }
TrackLayout   { id, centerline: [x,y][], profile: TrackSample[], sectors, pitLane }
```

### Persone

```ts
Person        { id, firstName, lastName, nationality, birthDay, reputation, morale,
                personality: { ambition, loyalty, temperament, professionalism, mediaSavvy },
                contractId?, status: 'active'|'free'|'retired'|'injured', history[] }

Rider extends Person {
  number, category, ridingStyle,
  attributes: { speed, racePace, braking, acceleration, cornerEntry, overtaking, defending,
                tyreManagement, fuelManagement, wet, consistency, aggression, concentration,
                technicalFeedback, adaptability, fitness, mentalStrength },
  potential (nascosto), growthCurve, form (−1..1), fatigue, injuries: Injury[],
  setupPreferences, crewChiefId?, trackEngineerId?, role: 'race'|'test'|'reserve'|'academy',
  careerStats, seasonStats
}
Injury        { id, riderId, type, bodyPart, severity, cause: 'race'|'practice'|'test'|'training'|'relapse',
                startDay, recoveryDaysEstimate: [min, max], expectedReturnDay, fitToRideRisk,
                medicalAssessment: { staffId, confidence, note } }
Fitness       { riderId, status: 'fit'|'unfit'|'pendingCheck'|'fitReduced', checkDay?, performanceFactor }
RiderAbsence  { id, riderId, teamId, injuryId, roundIds[], decisions: Record<RoundId, SeatDecisionId> }
SeatDecision  { id, teamId, seatRiderId, roundId, option: 'tester'|'substitute'|'vacant',
                replacementRiderId?, contractId?, decidedBy: 'player'|'ai', deadlineDay,
                expected: { points, cost, sponsorImpact, participationFeeLoss, penalty? },
                actual?: { points, cost, sponsorImpact } }
TemporaryContract extends Contract { kind: 'substitute', scope: 'singleRound'|'multiRound'|'untilReturn',
                roundIds[], feePerRound, signingCost, loanFeeToOriginTeam?, earlyReleaseOnReturn: boolean,
                extensionOption? }
TestRider extends Rider { role: 'test', testExperienceKm, developmentSkill, substituteAvailable: boolean,
                lentTo?: TeamId }      // collaudatore del costruttore prestato a un satellite
TestSession   { id, seasonId, circuitId, days[], categoryIds[], participants: { teamId, riderIds[], bikeIds[] }[],
                program: SessionRunPlan[] }
RookiesEntry  { riderId, seasonId, selectionRank, originChampionship, reserve: boolean }
NationalChampionship { id, country, ageRange, simulated: 'statistical', seasonResults[] }

StaffMember extends Person {
  role: 'technicalDirector'|'crewChief'|'trackEngineer'|'engineEngineer'|'electronicsEngineer'|
        'chassisEngineer'|'aeroEngineer'|'strategyChief'|'telemetryAnalyst'|'mechanic'|
        'productionManager'|'sportingDirector'|'athleticTrainer'|'physio'|'talentScout'|
        'sponsorManager'|'financeManager'|'logisticsManager'|'academyInstructor',
  skills: Record<RoleSkill, number>, experience, potential, assignedRiderId?
}
Relationship  { aId, bId, compatibility (−100..100), rivalry (0..100), trust, lastChangeDay }

// --- Squadra tecnica (revisione Fase 0, vedi TECH_TEAM.md) ---
StaffMember (campi aggiuntivi) {
  specialization: 'engine'|'electronics'|'chassis'|'aero'|'telemetry'|'trackside'|'mechanics'|'management',
  attributes: Record<StaffAttribute, number>,     // set dipendente dal ruolo (TECH_TEAM §3.2)
  potentialCeiling (nascosto), careerCurve: 'early'|'regular'|'late',
  ambition, loyalty, confidence, marketValue,
  experienceLog: { sessionsAnalyzed, diagnosesCorrect, diagnosesWrong, problemsSolved, trainingsDone },
  diagnosisHistory: Id[]                          // StaffHypothesis valutate (visibili al giocatore)
}
RiderStaffBond { riderId, staffId, trust, communication, compatibility, sharedSessions,
                 styleUnderstanding, satisfaction, conflictLevel, lastEventDay }
StaffAssignment { teamId, riderId, crewChiefId, trackEngineerId, analystId?, mechanicIds[], fromDay }
TrainingCourse  { id, staffId, targetAttributes[], cost, startDay, endDay, provider }
StaffScoutReport{ id, staffId, observerId, day, attributeRanges: Record<StaffAttribute,[min,max]>, notes }
```

### Organizzazioni

```ts
Manufacturer  { id, name, country, engineeringStrength, budget, philosophy,
                concessionsRank, suppliedTeamIds[], partnershipContracts[] }
Team          { id, name, shortName, nationality, baseCity, type:
                'private'|'independent'|'satellite'|'factory'|'newManufacturer',
                categoryIds[], manufacturerId, colors, livery, logo, raceNumbers[],
                reputation, boardObjectives[], history: TeamSeasonRecord[], aiProfile? }
Supplier      { id, kind: 'tyres'|'fuel'|'electronics'|'brakes'|'suspension', name, quality, cost }
Sponsor       { id, name, industry, country, budgetRange, reputationRequired, expectations,
                riskAppetite, exclusivityGroup }
Academy       { id, teamId, level, instructorIds[], riderIds[], programs[], budget }
```

### Tecnica

```ts
Bike          { id, teamId, riderId, slot: 'A'|'B', label: 'reference'|'experimental'|'dry'|'wet'|'spare',
                categoryId, season, components: Record<Slot, ComponentId>,   // Slot include 'accessories'
                setupId, mileageKm, wear, reliabilityNow, damage: Damage[], maintenance: MaintenanceState,
                readiness (0..1), availability: 'ready'|'preparing'|'damaged'|'notAllowed' }
                // slot 'B' esiste solo se Regulation.bikesPerRider = 2; le moto da test hanno label 'test'
EngineAllocation { riderId, season, allowed, usedEngineIds[] }   // condivisa fra Moto A e B
Damage          { componentId, severity, repairHours, cause, day }
MaintenanceState{ hoursSinceService, pendingJobs: Job[] }
Job             { id, bikeId, kind: 'setup'|'component'|'engine'|'repair'|'service', hoursRequired, hoursDone, assignedMechanicIds[] }
Component     { id, slot, designId, serial, mileageKm, condition, status: 'available'|'fitted'|'broken'|'sealed' }
ComponentDesign { id, ownerId (team|manufacturer), slot, version, stats: Record<Stat, number>,
                  reliability, weight, unitCost, homologated, seasonIntroduced }
RnDProject    { id, teamId, slot, approach: 'conservative'|'balanced'|'aggressive'|'experimental',
                budget, engineerIds[], startDay, expectedEndDay, progress, risk,
                targetStats, status: 'design'|'production'|'testing'|'done'|'failed'|'cancelled' }
Facility      { id, teamId, type, level, upgrade?: { targetLevel, endDay, cost }, upkeepPerMonth }
SetupSheet    { id, riderId, bikeId?, circuitId, conditions: 'dry'|'wet'|'mixed', values: Record<SetupParam, number>,
                notes, origin: 'library'|'briefing'|'rider'|'simulator', parentId? }
SetupLibraryEntry { teamId, circuitId, conditions, setupId, season, rating }

// --- Briefing e conoscenza (ADR-0003). I tipi Truth* restano nel motore. ---
TruthSetupIssue   (solo sim) { bikeId, area, cause: SetupParam[], magnitude }
SessionRunPlan    { sessionId, riderId, items: { goal: 'dryDev'|'raceSim'|'tyreTest'|'bikeB'|'wetData', laps }[] }
Observation       { id, sessionId, bikeId, kind: TelemetryIndicator, value, noise, laps }
RiderFeedback     { id, sessionId, riderId, bikeId, symptoms: { area, phraseKey, severity }[], satisfaction }
StaffHypothesis   { id, briefingId, staffId, area, suspectedCauses: SetupParam[], declaredConfidence,
                    outcome?: 'correct'|'partial'|'wrong' }   // outcome calcolato dopo la prova
SetupProposal     { id, hypothesisId, changes: Partial<Record<SetupParam, number>>, expectedGain: [min,max],
                    expectedDrawbacks: string[], targetBike: 'A'|'B' }
Briefing          { id, sessionId, riderId, kind: 'post'|'postQuali'|'preRace', timeBudgetMin, timeUsedMin,
                    feedbackId, hypothesisIds[], proposalIds[], decision?: BriefingDecision, delegatedTo? }
BriefingDecision  { type: 'accept'|'secondOpinion'|'compare'|'askCrewChief'|'riderFirst'|'keep'|'experimentB',
                    proposalId?, day }
ABComparison      { id, sessionId, riderId, deltaRaw, corrections: Record<string, number>, deltaCorrected,
                    sigma, validLapsA, validLapsB, reliability: 'low'|'medium'|'high' }
RacePlan          { riderId, roundId, tyres, fuelMode, paceTargets, rainScenarios: { condition, action }[],
                    contingency: string[], pitBoardScript[] }
```

### Contratti, mercato, economia

```ts
Contract      { id, kind: 'rider'|'staff'|'sponsor'|'supply'|'manufacturer'|'academy'|'loan',
                employerId, counterpartyId, startDay, endDay, salaryPerYear,
                bonuses: { condition, amount }[], clauses: Clause[], options: RenewalOption[],
                role, objectives[], status }
Clause        { type: 'release'|'performanceExit'|'buyout'|'promotion'|'noCompete'|'mediaDuties', params }
Negotiation   { id, subjectId, partyIds[], offers: Offer[], deadlineDay, status, rumourLevel }
Offer         { fromId, terms: Partial<Contract>, day, response?: 'accept'|'reject'|'counter' }
FinanceAccount{ teamId, balance, creditLimit, loans: Loan[] }
Transaction   { id, teamId, day, amount, category: IncomeCategory|ExpenseCategory, refId?, note }
Loan          { id, lender, principal, rate, startDay, termMonths, remaining }
SponsorDeal   { id, sponsorId, teamId, contractId, placement, valuePerYear,
                objectives[], satisfaction, activitiesDone[] }
```

### Media, storico, statistiche

```ts
DomainEvent   { id, day, type, payload }            // log degli eventi di dominio
NewsItem      { id, day, headline, body, tags[], refs[], importance, sourceEventIds[] }
Rumour        { id, day, subjectId, claim, reliability, revealedTruth? }
PressConference { id, roundId, questions: { text, options: Answer[] }[], effects }
RecordEntry   { kind, categoryId, holderId, value, day }
SeasonArchive { seasonId, finalStandings, rounds summary, champions, awards, transfers }
CareerStats   { starts, wins, podiums, poles, fastestLaps, points, dnfs, titles, perSeason[] }
```

### Ritratti e aspetto (ADR-0004)

```ts
Appearance    { personId, seed, skinTone, faceShape, hairStyle, hairColor, eyeColor, features[],
                ageVisualOffset }                        // identità visiva fissa
PortraitAsset { personId, kind: 'generated'|'photo', path?, sizeVariants: ('xs'|'s'|'m'|'l'|'xl')[] }
Outfit        { personId, teamId, type: 'racesuit'|'polo'|'formal', colors: [primary, secondary],
                number?, sponsorDecals[] }               // cambia con la squadra
```

## 4. Conoscenza e nebbia di guerra

La UI riceve **viste** dei dati, non le entità grezze. Esempio: potenziale di un giovane
pilota = intervallo stimato la cui ampiezza dipende dal livello degli scout e dalle
osservazioni effettuate. Questo evita che la UI possa mostrare per errore dati nascosti.

## 5. Versionamento

`schemaVersion` intero incrementato a ogni modifica incompatibile; ogni incremento
ha una migrazione testata in `packages/persistence/migrations`.

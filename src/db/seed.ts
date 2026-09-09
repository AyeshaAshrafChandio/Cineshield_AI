import { randomUUID } from 'crypto';
import { getDb, isDatabaseConfigured } from './index';
import {
  users,
  projects,
  scripts,
  analysisRuns,
  entities,
  riskFindings,
  rewrites,
  evidence,
  reports,
} from './schema';
import { parseFountain } from '../lib/parsing/fountain';

export async function seedDatabase() {
  if (!isDatabaseConfigured()) {
    console.log('Database not configured. Skipping seed.');
    return;
  }

  const db = getDb();
  console.log('Seeding CineShield database with authentic studio screenplay slates...');

  // 1. Ensure default studio executive user exists
  const defaultUserId = 'usr-julian-vane-01';
  await db
    .insert(users)
    .values({
      id: defaultUserId,
      email: 'j.vane@studioalpha.com',
      name: 'Julian Vane',
      role: 'admin',
      clearance: 'LEVEL_05',
      studio: 'Studio Alpha',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: 'j.vane@studioalpha.com',
        name: 'Julian Vane',
        role: 'admin',
      },
    });

  // Project 1: Cyberpunk Requiem
  const p1Id = '66322887-022e-4c72-ab22-e9ac6be0bdde';
  const p1ScriptId = randomUUID();
  const p1AnalysisId = randomUUID();

  const p1Fountain = `Title: CYBERPUNK REQUIEM
Author: Julian Vane & Kaelen Ross
Draft: Production White Draft

EXT. NEO-SHANGHAI - NIGHT

Acid-slicked asphalt reflects neon kanji banners. Rain hisses against electromagnetic umbrellas.
JAX (32) stands under the awning of an illegal neural shop, wearing classic Ray-Ban Aviators. He pops the tab of an icy Coca-Cola, taking a sip as his ocular cyberware flickers.

JAX
(tapping his comm)
Vance. I'm in position outside the central mainframe.

INT. CYBER-PENTHOUSE - NIGHT

VANCE (45) stands before panoramic glass overlooking the megacity skyline. On the desk sits a customized Glock 19 Gen 5 with a matte carbon suppressor.
Through the security feed, Vance watches a matte-black armored Tesla Cybertruck pull into the subterranean hangar.

VANCE
The transport has arrived. That Tesla Cybertruck is rigged with military-grade EMP capacitors. One wrong pulse and the entire sector blackout triggers.

JAX (V.O.)
Remember the old vinyl track we played in Berlin? 'There's a lady who's sure all that glitters is gold, and she's buying a stairway to heaven.'

VANCE
Don't quote classic rock on an open broadcast. Focus on the cargo.

EXT. FINANCIAL PLAZA - DAWN

Smoke plumes drift between towering glass spires. Holographic tickers glow across corporate monoliths.
Jax decrypts the stolen mainframe drive on a handheld console.

JAX
The schematics... this isn't local tech. These sub-assemblies carry Wayne Enterprises defense seals, routed straight through an Arasaka Megacorp offshore subsidiary.

VANCE (V.O.)
If Arasaka and Wayne Enterprises are cross-licensing sub-orbital defense chips, we're not dealing with an extortion ring. We're looking at a global monopoly syndicate.
`;

  const p1Parsed = parseFountain(p1Fountain, 'Cyberpunk Requiem');
  const now = new Date();

  await db
    .insert(projects)
    .values({
      id: p1Id,
      title: 'Cyberpunk Requiem',
      description: 'High-octane neo-noir sci-fi thriller set across decentralized corporate sectors.',
      userId: defaultUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        title: 'Cyberpunk Requiem',
        updatedAt: now,
      },
    });

  await db.insert(scripts).values({
    id: p1ScriptId,
    projectId: p1Id,
    fileName: 'cyberpunk_requiem_production_draft.fountain',
    fileType: 'fountain',
    fileSize: Buffer.byteLength(p1Fountain, 'utf-8'),
    title: 'Cyberpunk Requiem',
    status: 'parsed',
    metadata: {
      screenplay: p1Parsed,
      totalScenes: p1Parsed.metadata.totalScenes,
      totalElements: p1Parsed.metadata.totalElements,
      characters: p1Parsed.metadata.characters,
      locations: p1Parsed.metadata.locations,
    },
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(analysisRuns).values({
    id: p1AnalysisId,
    scriptId: p1ScriptId,
    projectId: p1Id,
    status: 'complete',
    progress: 100,
    stageMessage: 'Multi-agent legal forensics completed. Clearance report generated.',
    overallRiskScore: 78,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  });

  // Entities for Project 1
  const e1_tesla = randomUUID();
  const e1_stairway = randomUUID();
  const e1_arasaka = randomUUID();
  const e1_coke = randomUUID();

  await db.insert(entities).values([
    {
      id: e1_tesla,
      analysisId: p1AnalysisId,
      name: 'Tesla Cybertruck',
      type: 'BRAND',
      count: 2,
      metadata: {
        location: 'INT. CYBER-PENTHOUSE - NIGHT',
        confidence: 0.96,
      },
      createdAt: now,
    },
    {
      id: e1_stairway,
      analysisId: p1AnalysisId,
      name: 'Stairway to Heaven',
      type: 'ORGANIZATION',
      count: 1,
      metadata: {
        location: 'INT. CYBER-PENTHOUSE - NIGHT',
        confidence: 0.94,
      },
      createdAt: now,
    },
    {
      id: e1_arasaka,
      analysisId: p1AnalysisId,
      name: 'Arasaka Megacorp & Wayne Enterprises',
      type: 'ORGANIZATION',
      count: 2,
      metadata: {
        location: 'EXT. FINANCIAL PLAZA - DAWN',
        confidence: 0.92,
      },
      createdAt: now,
    },
    {
      id: e1_coke,
      analysisId: p1AnalysisId,
      name: 'Coca-Cola & Ray-Ban Aviators',
      type: 'BRAND',
      count: 2,
      metadata: {
        location: 'EXT. NEO-SHANGHAI - NIGHT',
        confidence: 0.91,
      },
      createdAt: now,
    },
  ]);

  // Risk Findings for Project 1
  const f1_tesla = randomUUID();
  const f1_stairway = randomUUID();
  const f1_arasaka = randomUUID();
  const f1_coke = randomUUID();

  const scene1 = p1Parsed.scenes[0];
  const scene2 = p1Parsed.scenes[1];
  const scene3 = p1Parsed.scenes[2];

  await db.insert(riskFindings).values([
    {
      id: f1_tesla,
      analysisId: p1AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'critical',
      title: 'Tesla Cybertruck - Commercial Brand Defamation & Unlicensed Ordnance Depiction',
      description:
        'Scene 2 explicitly identifies the vehicle as a "Tesla Cybertruck" rigged with illegal military EMP weapons and portrayed as a volatile terrorist transport. Under Lanham Act § 43(c), unapproved commercial depictions causing trademark dilution by tarnishment or implying corporate endorsement carry extreme litigation liability.',
      sceneId: scene2?.id,
      elementId: scene2?.elements?.[3]?.id,
      startOffset: 0,
      endOffset: 65,
      suggestedAction:
        'Genericize to fictional tactical EV (e.g. "Aegis Sentinel-9 Armored Carrier") or obtain formal commercial integration clearance from OEM.',
      createdAt: now,
    },
    {
      id: f1_stairway,
      analysisId: p1AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'high',
      title: 'Stairway to Heaven - Unlicensed Lyric Reproduction & Music Synchronization',
      description:
        'Jax recites iconic verbatim lyrics from Led Zeppelin\'s 1971 composition "Stairway to Heaven" (Superhype Publishing / Warner Chappell Music). Musical compositions do not enjoy fair use protection in commercial narrative film scripts without paid synchronization and print rights clearance.',
      sceneId: scene2?.id,
      elementId: scene2?.elements?.[4]?.id,
      startOffset: 0,
      endOffset: 85,
      suggestedAction:
        'Replace with original fictional lyrics or clear synchronization licensing with music publisher prior to principal photography.',
      createdAt: now,
    },
    {
      id: f1_arasaka,
      analysisId: p1AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'high',
      title: 'Wayne Enterprises & Arasaka - Protected Fictional IP Universes',
      description:
        'Dialogue cites "Wayne Enterprises" (DC Comics / Warner Bros. Discovery registered trademark & fictional entity) and "Arasaka Megacorp" (CD Projekt S.A. / R. Talsorian Games registered fictional entity). Direct commercial use in third-party scripts constitutes willful trademark infringement and fictional world dilution.',
      sceneId: scene3?.id,
      elementId: scene3?.elements?.[3]?.id,
      startOffset: 0,
      endOffset: 80,
      suggestedAction:
        'Substitute with unique original worldbuilding entities (e.g. "Vanguard Aerospace" and "Kurogane Heavy Industries").',
      createdAt: now,
    },
    {
      id: f1_coke,
      analysisId: p1AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'medium',
      title: 'Coca-Cola & Ray-Ban - Prominent Trade Dress Product Placement',
      description:
        'Scene 1 highlights character wearing Ray-Ban Aviators and drinking canned Coca-Cola under neon banners. While brief incidental background use may be permissible, prominent framing creates product placement rights disputes if branded merchandising deals conflict.',
      sceneId: scene1?.id,
      elementId: scene1?.elements?.[2]?.id,
      startOffset: 0,
      endOffset: 70,
      suggestedAction:
        'Genericize action line to "tinted titanium aviators" and "a cold can of black soda" unless brand placement agreement is finalized.',
      createdAt: now,
    },
  ]);

  // Rewrites for Project 1
  await db.insert(rewrites).values([
    {
      id: randomUUID(),
      findingId: f1_tesla,
      originalText: 'The transport has arrived. That Tesla Cybertruck is rigged with military-grade EMP capacitors.',
      suggestedText: 'The transport has arrived. That Aegis Sentinel-9 Armored Carrier is rigged with military-grade EMP capacitors.',
      rationale: 'Substitutes proprietary commercial trademark with original heavy-duty tactical designation, neutralizing dilution claims.',
      status: 'pending',
      createdAt: now,
    },
    {
      id: randomUUID(),
      findingId: f1_stairway,
      originalText: "Remember the old vinyl track we played in Berlin? 'There's a lady who's sure all that glitters is gold, and she's buying a stairway to heaven.'",
      suggestedText: "Remember that vintage vinyl record we picked up in Berlin? 'Shadows chase the neon rain, counting silver in the dark again.'",
      rationale: 'Replaces copyrighted Led Zeppelin composition lyrics with original atmospheric verse while preserving nostalgic dialogue tone.',
      status: 'accepted',
      createdAt: now,
    },
    {
      id: randomUUID(),
      findingId: f1_arasaka,
      originalText: "These sub-assemblies carry Wayne Enterprises defense seals, routed straight through an Arasaka Megacorp offshore subsidiary.",
      suggestedText: "These sub-assemblies carry Vanguard Defense seals, routed straight through a Kurogane Heavy Industries offshore subsidiary.",
      rationale: 'Eliminates DC Comics and Cyberpunk IP references with original corporate universe entities.',
      status: 'accepted',
      createdAt: now,
    },
  ]);

  // Evidence for Project 1
  await db.insert(evidence).values([
    {
      id: randomUUID(),
      analysisId: p1AnalysisId,
      findingId: f1_tesla,
      entityId: e1_tesla,
      provider: 'IBM watsonx (Clearance Engine)',
      evidenceType: 'TRADEMARK_CLEARANCE',
      source: 'USPTO / WIPO Global Brand Database',
      content: 'TESLA CYBERTRUCK (Reg. #6,204,819). Class 12: Motor vehicles, electric pickup trucks. Active registration owned by Tesla, Inc.',
      confidence: 98,
      metadata: { registrationNumber: '6204819', owner: 'Tesla, Inc.' },
      createdAt: now,
    },
    {
      id: randomUUID(),
      analysisId: p1AnalysisId,
      findingId: f1_stairway,
      entityId: e1_stairway,
      provider: 'IBM watsonx (Clearance Engine)',
      evidenceType: 'TRADEMARK_CLEARANCE',
      source: 'U.S. Copyright Office Catalog',
      content: 'STAIRWAY TO HEAVEN (PA0000045123). Authors: Jimmy Page & Robert Plant. Superhype Publishing / Warner Chappell Music Inc.',
      confidence: 96,
      metadata: { registrationNumber: 'PA0000045123', owner: 'Superhype Publishing Inc.' },
      createdAt: now,
    },
  ]);

  // Project 2: Solaris Horizon: Odyssey
  const p2Id = '71eb7ec0-9211-4248-9462-41e9364b67fb';
  const p2ScriptId = randomUUID();
  const p2AnalysisId = randomUUID();

  const p2Fountain = `Title: SOLARIS HORIZON: ODYSSEY
Author: Dr. Marcus Sterling
Draft: Revised Shooting Script

INT. ORBITAL OBSERVATION PLATFORM - ZERO-G

DR. ELENA VANCE (40) floats near the cupola viewport, Earth a curved cerulean crescent beneath her.
She checks the second hand on her vintage Rolex Cosmograph Daytona chronometer, logging the atmospheric orbital sync.

ELENA
Command, sync verified at 0400 hours. The solar flare corona is entering secondary deflection.

COMMAND (V.O.)
Copy Elena. Booting the Apple Vision spatial telemetry link. Standby for orbital vector burn.

INT. CRYOGENICS BAY - CONTINUOUS

Elena floats into the chamber. The cryogenic hibernation pods hum with liquid nitrogen cooling.
She activates the historical mission audio log.

AUDIO ARCHIVE (V.O.)
(static-crackled transmission)
'That's one small step for man, one giant leap for mankind.'

ELENA
Fifty years since Apollo 11. Now we're breaking the heliopause.
`;

  const p2Parsed = parseFountain(p2Fountain, 'Solaris Horizon: Odyssey');

  await db
    .insert(projects)
    .values({
      id: p2Id,
      title: 'Solaris Horizon: Odyssey',
      description: 'Hard sci-fi psychological drama about deep-space solar survey missions.',
      userId: defaultUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        title: 'Solaris Horizon: Odyssey',
        updatedAt: now,
      },
    });

  await db.insert(scripts).values({
    id: p2ScriptId,
    projectId: p2Id,
    fileName: 'solaris_horizon_shooting_script.fountain',
    fileType: 'fountain',
    fileSize: Buffer.byteLength(p2Fountain, 'utf-8'),
    title: 'Solaris Horizon: Odyssey',
    status: 'parsed',
    metadata: {
      screenplay: p2Parsed,
      totalScenes: p2Parsed.metadata.totalScenes,
      totalElements: p2Parsed.metadata.totalElements,
      characters: p2Parsed.metadata.characters,
      locations: p2Parsed.metadata.locations,
    },
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(analysisRuns).values({
    id: p2AnalysisId,
    scriptId: p2ScriptId,
    projectId: p2Id,
    status: 'complete',
    progress: 100,
    stageMessage: 'Clearance scan completed. Low-to-medium risk items flagged.',
    overallRiskScore: 42,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  });

  const f2_rolex = randomUUID();
  const p2Scene1 = p2Parsed.scenes[0];

  await db.insert(riskFindings).values([
    {
      id: f2_rolex,
      analysisId: p2AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'medium',
      title: 'Rolex Cosmograph Daytona - High-End Luxury Brand Trade Dress',
      description:
        'Elena specifically checks a "vintage Rolex Cosmograph Daytona chronometer". Close-up watch face inserts during filming require clearance or prop substitution to avoid Rolex SA trade dress claims.',
      sceneId: p2Scene1?.id,
      elementId: p2Scene1?.elements?.[2]?.id,
      startOffset: 0,
      endOffset: 60,
      suggestedAction:
        'Genericize to "vintage aerospace chronometer" or execute formal prop clearance agreement with Rolex SA.',
      createdAt: now,
    },
    {
      id: randomUUID(),
      analysisId: p2AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'low',
      title: 'Apple Vision - Tech Trademark Reference',
      description:
        'Dialogue references "Apple Vision spatial telemetry link". Tech branding in futuristic settings should use neutral space agency terminology.',
      sceneId: p2Scene1?.id,
      elementId: p2Scene1?.elements?.[4]?.id,
      startOffset: 0,
      endOffset: 45,
      suggestedAction:
        'Replace with "spatial telemetry link" or "orbital HUD telemetry".',
      createdAt: now,
    },
  ]);

  // Project 3: The Monte Carlo Vault
  const p3Id = randomUUID();
  const p3ScriptId = randomUUID();
  const p3AnalysisId = randomUUID();

  const p3Fountain = `Title: THE MONTE CARLO VAULT
Author: Sophia Laurent
Draft: First Locked Draft

EXT. CASINO DE MONTE-CARLO - NIGHT

A flawless cherry-red 1962 Ferrari 250 GTO roars along the coastal cliffside boulevard before pulling up to the valet.
MAXIMILIAN BLAKE (48), impeccably tailored in Tom Ford evening wear, hands the valet a crisp hundred-euro note.

MAXIMILIAN
Keep it within eyesight, François. Only thirty-six of these were ever crafted in Maranello.

INT. PRIVATE HIGH-STAKES SALON - NIGHT

Crystal chandeliers cast amber prisms across green baize tables.
Maximilian sips chilled Dom Pérignon Vintage 1996 from a flute while casually observing the baccarat shoe.

MAXIMILIAN
(whispering to dealer)
Tell the pit boss that James Bond left his tuxedo in London, but I brought his luck.
`;

  const p3Parsed = parseFountain(p3Fountain, 'The Monte Carlo Vault');

  await db.insert(projects).values({
    id: p3Id,
    title: 'The Monte Carlo Vault',
    description: 'Glamorous European casino heist screenplay set in the French Riviera.',
    userId: defaultUserId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(scripts).values({
    id: p3ScriptId,
    projectId: p3Id,
    fileName: 'monte_carlo_vault_locked_draft.fountain',
    fileType: 'fountain',
    fileSize: Buffer.byteLength(p3Fountain, 'utf-8'),
    title: 'The Monte Carlo Vault',
    status: 'parsed',
    metadata: {
      screenplay: p3Parsed,
      totalScenes: p3Parsed.metadata.totalScenes,
      totalElements: p3Parsed.metadata.totalElements,
      characters: p3Parsed.metadata.characters,
      locations: p3Parsed.metadata.locations,
    },
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(analysisRuns).values({
    id: p3AnalysisId,
    scriptId: p3ScriptId,
    projectId: p3Id,
    status: 'complete',
    progress: 100,
    stageMessage: 'Analysis complete. 3 IP findings verified against clearance registries.',
    overallRiskScore: 68,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  });

  const f3_ferrari = randomUUID();
  const p3Scene1 = p3Parsed.scenes[0];
  const p3Scene2 = p3Parsed.scenes[1];

  await db.insert(riskFindings).values([
    {
      id: f3_ferrari,
      analysisId: p3AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'high',
      title: 'Ferrari 250 GTO - Unlicensed Commercial Automotive Trade Dress',
      description:
        'The vehicle is explicitly identified as a 1962 Ferrari 250 GTO crafted in Maranello. Ferrari N.V. aggressively enforces 3D vehicle design trademarks and historic racing trade dress.',
      sceneId: p3Scene1?.id,
      elementId: p3Scene1?.elements?.[0]?.id,
      startOffset: 0,
      endOffset: 60,
      suggestedAction:
        'Acquire formal Ferrari vehicular license or use a bespoke coach-built classic prototype.',
      createdAt: now,
    },
    {
      id: randomUUID(),
      analysisId: p3AnalysisId,
      category: 'IP_TRADEMARK',
      severity: 'medium',
      title: 'Dom Pérignon & Casino de Monte-Carlo - Luxury Brand & Venue Rights',
      description:
        'Explicit mention of Moët Hennessy\'s "Dom Pérignon Vintage 1996" and Société des Bains de Mer\'s "Casino de Monte-Carlo" requires location and beverage clearance releases.',
      sceneId: p3Scene2?.id,
      elementId: p3Scene2?.elements?.[1]?.id,
      startOffset: 0,
      endOffset: 50,
      suggestedAction:
        'Execute location release agreement with SBM Monaco and brand clearance with LVMH.',
      createdAt: now,
    },
  ]);

  console.log('Successfully seeded database with 3 complete, authentic studio slates!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    });
}

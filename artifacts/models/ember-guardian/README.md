# 暮火守卫

The final boss is authored in `src/ember-guardian.ts` against the approved slim concept `artifacts/concepts/final-boss/ember-guardian-slim-04.png`. It reuses the existing dark knight's helmet, face and eyes and builds the slimmer torso, jointed limbs, shoulder crest, tattered mantle, belt key and ember sword as named rigid assemblies. Runtime uses the source factory; `ember-guardian.glb` is a checked reference export, not a separate runtime copy.

## Encounter contract

The player reads the orange ground warning, moves or dodges out of the locked attack direction, then blows wind during the green recovery opening. Three successful counters yield the exit key. Failure returns the player to the island checkpoint; the boat remains the return route. This pass replaces the old final boss charge/shield presentation without changing the two earlier knights.

Sword attacks cycle through diagonal cut, broad sweep, and overhead slam. Windups last 1.25 / 1.5 / 1.7 seconds; recovery lasts 2.6 / 2.8 / 3 seconds. Each swing can remove one heart at most. A hit can occur only inside its matching warning footprint, with no tracking after the warning starts. The guardian approaches at 2.8 units/second and respects the existing walkability/obstacle checks. Sword attacks and procedural poses share the fixed simulation clock. Keys drop where the guardian is defeated.

`src/guardian-combat.ts` owns poses, attack sequencing, hit tests, warnings, slam impact and the imported Ember blade trail. `src/maze.ts` retains input, player health, rewards, checkpoints, audio and progression. No new dependencies or remote runtime calls.

## VFX provenance

Blade trail: 00GameDevs `Weapon Smear`, https://ember-three-vfx.pages.dev/zh-TW/#effects . Exported asset source is MIT licensed; source and notice are retained under `src/vendor/ember-vfx/`. Existing game SFX are reused at strike, damage and reward cues.

## Validation

- `npm run build`: TypeScript and Vite production build.
- `tests/ember-guardian-model.mjs`: finite geometry, actual visible-model height ratio, studio front/side/back views, attack poses, canvas pixels, sword-hit boundary checks, binary GLB export and reload bounds.
- `tests/guardian-sword.mjs`: built `dist` browser tests for the three attacks, real damage, one-hit-per-swing behavior, warnings, locked direction, escapes, keyboard dodge, wind guard/recovery, imported blade history, pause, reduced motion, natural sequence, pursuit, displaced key collection, checkpoint recovery, reset and touch counter.
- `tests/dark-knight.mjs`: existing minion model/behavior regression updated to expect the sword guardian only in the final slot.

Screenshots and machine-readable reports live beside this file. The `production` screenshots use the normal gameplay camera. Studio images are model inspection views. Browser tests set up encounters directly and drive the real update/input code; they do not constitute physical-device or player-study evidence.

Initial model report: 31,648 triangles, 50 meshes, 1.823 units tall (1.448 times the visible ordinary knight), 1,968,524-byte binary GLB. These original studio previews and export are retained for comparison. The current Astra remake, views, GLB and source/validation notes are under `astra-remake/`; `refinement/` and other earlier versions remain historical references. Runtime uses the revised source factory.

The latest production sword test (`astra-remake/production/result.json`) reports 114 render calls and 129,316 rendered triangles in its mobile recovery view, no browser/page/network errors, natural attack sequence `0 → 1 → 2 → 0`, and successful pursuit into the expanded arena. These are view-specific counters, not a sustained real-device frame-rate measurement.

The sword test, model/export test, ordinary-knight regression and wind-wand quest regression passed. The arena/boat test is also run as a separate browser process to avoid audio-device contention between simultaneous Chromium instances.

## Reference ledger and limits

Read: Three.js gameplay workflows, encounter design, physics selection, game feel, QA checklists, visual verification, procedural geometry/material/performance checklists, and game-asset 3D pipeline references. Existing Rapier locomotion is reused; sword volumes are analytic arcade hit tests, separate from render geometry.

The test harness extends the project's deterministic browser checks and saves new model/pose views. No automatic image-diff baseline is introduced while the newly authored art remains under review. No new boss music, generated SFX, additional phases, global lighting changes, deployment or ZIP packaging. Actual device frame time and sustained playtesting remain unverified.

Preserved grip milestone: `upright-grip/` contains the user-confirmed one-handed low stance, upright cutting plane, studio views, grip closeup and reference GLB. The blade is fixed a quarter turn relative to the palm, with its cutting plane following the knuckles. Runtime idle, pursuit and recovery share `holdGuardianSwordReady`; attacks aim the wrist, keeping the hand and hilt together. `sword-grip/` preserves the superseded chest-level stance and `vertical-sword/` the earlier raised-arm attempt for comparison.

## Latest: Astra remake (2026-10-28)

Gameplay size update: `src/maze.ts` now places the final guardian at uniform scale 1.6 (about 2.2 times the ordinary knight's visible height), and uses a 1.8-unit recovery ring. The source factory and studio export remain at authoring scale. `larger-boss/` contains the new in-game size screenshot and combat regression report.

`astra-remake/` is the current inspected model: 62 meshes, 58,058 triangles, 1.746 units tall including the sole bounds (1.387 times the ordinary knight), and a 4,069,956-byte reference GLB. `model-result.json` records finite geometry, the budget, all sword poses, animated fire, reduced motion, GLB roundtrip and no browser errors. The model test also checks that the thick, perforated cape has positive enclosed volume, catching inward face winding. `ember-guardian.ts.txt` snapshots the factory that produced these views.

This is a procedural Three.js interpretation of the user's Tripo viewport and approved concept, not a downloaded or copied Tripo mesh. The remake builds a solid swept helmet crest with inset amber details, curved double-rim shoulder armor, a continuous thick cape with upper drapes, lower flutes and torn holes, and nested chest plates following one surface. It preserves the user's one-handed low sword stance and quarter-turned blade, the existing three attacks and runtime fire. The ordinary knight source is unchanged.

The final production validation and gameplay screenshots are in `astra-remake/production/`; the prior `production/` evidence is retained unchanged. `npm run build`, `tests/ember-guardian-model.mjs` and `tests/guardian-sword.mjs` were rerun for this revision. Prior ordinary-knight, quest and boat regressions above describe earlier work and were not rerun for this model-only revision. Production verification covers all three attacks, real hits, locked aim, dodge, recovery counters, pursuit, key collection, reset, pause, reduced motion and emulated touch controls.

Limits: the cape remains a rigid animated assembly, not a cloth simulation. Fine Tripo sculpting, texturing and exact folds are approximated by low-cost procedural geometry and materials. There is no downloaded Tripo asset, new dependency, deployment, ZIP or physical-device performance claim.

## Relaxed sword arm (2026-10-28)

Latest pose evidence is in `relaxed-arm/` and `relaxed-arm/production/`. The shared ready pose reduces elbow flexion from 0.75 to 0.12 radians and shoulder outward tilt from 0.08 to 0.04 radians. The lower hand retains the one-handed grip, upright blade plane and near-ground tip. Idle, pursuit and recovery use this shared pose; gameplay scale remains 1.6.

Build, model/pose/fire/GLB checks and production sword regression passed with no browser errors. Side and grip-closeup renders were inspected. The latest authoring height is 1.7284 units, with 62 meshes and 58,058 triangles. Earlier Astra views remain historical evidence of the prior pose. Physical-device performance was not checked.

## Skeletal animation (2026-10-28)

`rigged/` supersedes earlier pose evidence. The existing armor is rigid-weight bound to a shared 17-bone Three.js Skeleton (body, head, cape, shoulders, upper arms, elbows, wrists, hips, knees and ankles). Knee/ankle assemblies retain their original geometry. The sword remains attached to the wrist. This is authored locally; no Tripo API task or downloaded rig was used.

Thirteen AnimationClips are sampled through AnimationMixer: idle, walk, hurt, death, and windup/strike/recovery for each of cut, sweep and slam. Phase progress controls sampling so pause and combat timing remain deterministic. Idle/walk loops close, windup connects to strike, and strike connects to recovery. Hurt recoils and settles; death bends the knees and lowers the head for 1.2 seconds before hiding. Foot grounding is baked into walking/hurt/death clips. Contact begins at 45 percent of each strike. The key remains available immediately on defeat.

`animations.webm` previews the sequence. `ember-guardian.glb` includes skins and all 13 clips; animated billboard fire remains runtime-only. Tests cover clip/skin export and reload, exported knee animation, loop closure, attack transitions, blade floor clearance, foot grounding, pause, damage, death visibility, key collection, reset and touch. Geometry remains 58,058 triangles; splitting the knees/ankles increases the mesh count from 62 to 70. See model-result.json and production/result.json for latest results.

Limits: rigid armor weighting and a one-bone cape, not soft skin or simulated cloth. Motion is authored in place; gameplay supplies root movement. No physical-device performance measurement or deployment.

## Weighted diagonal cut (2026-10-28)

`weighted-cut/` is the latest animation evidence. A new chest bone separates upper-body rotation from the hips (18 bones total). The first sword attack now uses authored loading, foot plant, accelerating diagonal cut, held follow-through and recovery poses. The off-hand counterbalances the swing and the head partly counters chest rotation. Wrist aiming includes the new ancestor chain, keeping the sword attached through the torso turn.

Walking uses a planted stance segment and a lifted return segment with two-link leg solving. Runtime walk time advances from actual traveled distance, scaled by model size, rather than the global clock; blocked movement no longer advances the walk loop. The existing warning shapes, collision navigation, attack reach and player controls remain in place. This pass focuses on the diagonal cut and locomotion; sweep/slam choreography, art proportions, sound design and cloth simulation have not been rebuilt.

The game-feel skill informed anticipation, acceleration and follow-through. No camera shake was added. The current preview is animations.webm and the exported animated model is ember-guardian.glb in this directory. Physical-device performance remains unverified.

## Forward pursuit gait (2026-10-28)

`forward-walk/` replaces the seated-looking chase gait. Visual references inspected: Bandai Namco's Elden Ring gameplay preview (https://www.youtube.com/watch?v=JldMvQMO_5U, Stormveil traversal around 10:27) and Soul of Cinder fight footage (https://www.youtube.com/watch?v=IlPGu5hxRSI, opening approach/combat). Epic's distance-matching documentation informed distance-driven playback, not a claim about FromSoftware internals.

The moving pelvis is raised and shifted forward, the chest leans forward 0.12 radians, swing-foot lift drops from 0.065 to 0.03, and the stance path extends farther behind the hips. Removed a later body-height overwrite which discarded the authored pelvis height. Chase speed changes from 2.8 to 2.0 units/second; this intentionally makes kiting easier. Four side-view gait samples are included, with checks for excessive knee bend and torso lean. Attack ranges and timing remain unchanged. Actual hardware performance remains unverified.

## Weighted horizontal sweep (2026-10-28)

Latest sweep evidence: `weighted-sweep/`. Attack 1 now uses its own load, hip-led rotation, horizontal cut, held follow-through and recovery keys through the same authored-pose sampler as the diagonal cut. The hips rotate before the chest releases, both feet support a staggered stance, the head counters chest rotation, and the off-hand/cape counterbalance the motion. The blade stays close to horizontal during the active sweep. Windup/active/recovery timing, damage, warning sector and attack reach are unchanged.

`sweep-load.png`, `sweep-contact.png`, `sweep-follow-through.png` and `sweep-recover.png` show the key poses; `animations.webm` includes the revised sweep in the full sequence. Checks cover horizontal blade direction, torso loading, foot/floor clearance, phase continuity and animated GLB export. `production/` contains the gameplay regression. Heavy slam, hurt/death choreography and cloth simulation are outside this sweep revision. Physical-device performance remains unverified.

## Continuous sweep timing (2026-10-28)

`fluid-sweep/` supersedes the previous sweep timing. The old per-segment smoothstep forced zero speed at every intermediate pose, and repeated follow-through keys held the body/sword still. Sweep interpolation now uses monotone cubic Hermite tangents in actual phase seconds (1.5 windup, 0.6 active, 2.8 recovery), preserving velocity across intermediate keys while preventing scalar overshoot. The loaded and trailing poses drift slightly instead of freezing. Cut and slam retain their existing interpolation. Damage windows, reach and phase durations are unchanged.

Reference reading: PlayStation's God of War combat discussion (https://blog.playstation.com/2022/10/04/game-developers-explain-what-makes-god-of-war-2018s-combat-tick/) and Animation Mentor's overlap tutorial (https://www.animationmentor.com/blog/tutorial-overlap-pendulum-motion-animation/). These inform follow-through and overlapping motion, not a claim to replicate those games' implementation.

New assertions check nonzero, continuous blade-direction speed through the intermediate sweep keys, alongside phase transitions, horizontal trajectory, floor clearance, skeleton/animation export and combat regression. `animations.webm` now shows two sweep cycles at actual gameplay phase durations; earlier previews compressed recovery and should not be used to judge real-time cadence. Real-device frame time is unverified.

## Weighted overhead slam (2026-10-28)

`weighted-slam/` is the latest heavy-slam revision. Attack 2 uses authored high-hand loading, forward torso drive, staggered leg support, accelerating overhead descent, flexed landing/settle and continuous recovery. It shares monotone cubic interpolation with sweep, using its own physical phase durations (1.7 / 0.55 / 3 seconds). The sword remains in a vertical cutting plane and the hand stays attached. Cut and sweep use their existing keys.

Slam contact moves from 45 to 60 percent of the active interval to align with the descending blade. Impact ring placement now captures the actual sword-tip X/Z on the contact frame. Phase durations, range, damage amount and warning lane remain unchanged. Tests check raised wrist height, torso drive, foot/floor clearance, no blade floor penetration, no wrist flip, phase continuity, delayed contact, pause/reset and exported skeleton/clips. `animations.webm` records two heavy-slam cycles at gameplay phase durations.

Reference evidence: located Greatsword Moveset (Dark Souls 3), https://www.youtube.com/watch?v=BOofzxLNI_c; direct playback was unavailable because local browser use is disabled, and web fetch of that video failed. Read the primary developer discussion at https://blog.playstation.com/2022/10/04/game-developers-explain-what-makes-god-of-war-2018s-combat-tick/ (Capcom/Naughty Dog comments on weight, positioning, arcs and follow-through). Capcom MH4U manual search result was available, but opening the manual returned 403. No claim of frame-by-frame video comparison. No new model, SFX, camera shake, cloth simulation, deployment or physical-device performance verification.

## Idle and disengage return (2026-10-28)

`idle-return/` is the latest idle/return revision. Idle adds chest breathing, a small lateral weight shift, counter motion in the head, and restrained sword-arm motion in a closed 2.4-second loop. Pelvis height is fixed so breathing does not lift both feet. Reduced motion samples the still idle pose.

Removed distance-proportional home lerp (which could reach 20 units/second at a 10-unit displacement). Chase/return share collision-aware movement with acceleration and a bounded turn rate. Return speed is capped at 1.6 units/second, chase at 2, turn rate at 3.5 radians/second. The guardian first turns toward the destination, slows near home, stops within 0.025 units and turns back to its initial guard heading. Return is latched outside aggro; a nearby player inside the arena can interrupt it. Damage is retained. Locomotion blends with idle over roughly 0.17 seconds to reduce starting/stopping pose pops. Movement still uses the existing collision-clearance and side-step checks, not a new pathfinder.

Tests exercise max return speed/turn rate, actual leg animation, home arrival and stable stop, collision rejection, reacquisition, attack behavior, pause/reset, plus idle loop, chest motion and sword-floor clearance. Blade floor tests now use precise skinned bounds rather than cached boxes. `animations.webm` previews idle; `production/return-home.webm` shows the in-game turn/return/stop. Dedicated turn-in-place foot choreography and physical-device frame-time measurements remain unimplemented/unverified.

## Authored hit reaction (2026-10-28)

`weighted-hurt/` contains the latest hurt revision. The 0.8-second nonlethal stun now has a fast 80-ms chest/shoulder recoil, slightly delayed head/cape motion, planted-leg bracing and eased recovery. The sword arm bends with the response and maintains blade/floor clearance. Death retains its existing choreography.

`GuardianCombat.reactToHit` snapshots the current bone pose on a real successful nonlethal wind hit. During the first 80 ms the runtime blends from that snapshot into the authored hurt clip, reducing the jump from attack recovery to a generic idle-based hit pose. The incoming side controls torso/head roll and torso yaw. Guard-only hits do not trigger the reaction, and dying hits still use death. A leftover guard flash no longer overrides the stun pose. Reset clears the captured reaction.

Model checks cover visible recoil within 80 ms, floor/foot clearance, settling, exported animation and all prior sword poses. Production checks trigger real hits from both sides, compare first-frame wrist rotation, verify opposite side reactions, prevent repeated damage during stun, and check recovery. `animations.webm` previews the authored clip; runtime also blends from the actual interrupted pose.

Reference basis is the previously read primary developer discussion at https://blog.playstation.com/2022/10/04/game-developers-explain-what-makes-god-of-war-2018s-combat-tick/ on clear hit poses, animation reactions and coordinated follow-through. A refresh attempt timed out. No new video viewing, camera shake, audio, physical knockback, model changes, or physical-device performance verification is claimed.

## Reactions selected by the previous boss attack (2026-10-28)

`contextual-hurt/` supersedes the single hurt clip. The player still has one wind attack with unchanged damage and 0.8-second stun. The boss's current attack index selects hurt0 (chest recoil with a backward recovery step), hurt1 (continued torso twist with a lateral stabilizing step), or hurt2 (forward fold into sword support and rise). The exported rig now has 15 clips, including these three hurt clips. Existing snapshot blending still starts from the actual interrupted recovery pose.

Nonlethal reaction travel is collision checked: cut pushes back at most 0.35 units, sweep sideways at most 0.28, slam stays in place. There is no random reaction strength or additional player attack. The expression briefly opens the eyes, then narrows them during bracing; a three-star flash lasts 0.22 seconds. Reduced motion keeps the star scale fixed. Lethal hits retain the existing death action.

The model regression checks all three distinct torso poses, sword and foot clearance throughout every hurt clip and all 15 exported animations. The production regression uses the same real wind action after each of the three attacks, verifies pose continuity, distinct reactions, bounded travel, one damage event and complete recovery. The studio video now calls the real reaction/update path for the three cases, including root travel and the star feedback.

Design follows the user-approved adaptation discussed after the Nintendo Kirby developer interview, not a claim to replicate an observed Kirby boss animation. No new ability, new damage tiers, new audio, deployment, or physical-device performance claim.

## Shared ash death and Boss health (2026-10-29)

`ash-death/` is the latest death revision. The guardian now reuses the ordinary knight's `animateKnightAsh` effect: loss of color, grain dissolve, drifting ash, then disappearance over the shared 1.25-second death duration. The shared helper supports multi-material meshes for the forged blade and skips runtime flame VFX; the ordinary knight's existing effect parameters are unchanged. Boss dust height is adjusted to its taller silhouette. The guardian retains a short kneeling motion and blends from the lethal-hit pose. Sword fire/glow stop early in death, while reset restores exact original materials, cast-shadow flags, body visibility and sword VFX. Key drop remains immediate and collectable.

The UI now includes the boss in the existing enemy health-meter pipeline. Its fixed top bar shows the localized guardian name, three health segments and current/max numbers, with the existing damage trail and reduced-motion behavior. Placement follows the guidance box to avoid overlap. Ordinary knight meters retain their projected positions. The boss bar hides on death, pause/inactive gameplay, loss of sight or distance above 14 units, and restores with current health on re-entry/reset.

Build and model checks pass, including skinned/multi-material dissolve, ordinary-knight material restoration, boss restoration and all 15 animation clips. `animations.webm` and `ash-6/15/24.png` show full-frame gray/dissolve/dispersal views. The production regression covers real damage, health values, key/death/reset and 390x844 / 844x390 layouts; `verify-boss-death.mjs` skips only the unrelated return-home video recording. A paused test harness explicitly renders the next frame before asserting health-bar hiding, matching the normal game's render loop.

No new dependency, external asset, deployment or ZIP. Physical-device frame time remains unverified.

## Larger health meter (2026-10-29)

Boss meter desktop width grows from 440 to 640 pixels; track height from 13 to 19, with an enlarged crest and 18-pixel name. Responsive width stays within 16-pixel side margins. `larger-health/` records desktop, portrait, landscape and actual wind-damage screenshots. Build and the focused layout/damage check passed. Damage rules and the 3-HP encounter remain unchanged pending the user's choice of a revised damage design; no new damage values are claimed implemented.

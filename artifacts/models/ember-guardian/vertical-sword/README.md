# Vertical sword pose

Historical comparison only: superseded by the user's later grip correction in `../sword-grip/`. The current runtime no longer uses this raised-arm, downward stance.

User direction: sword vertical, tip pointing down near the ground.

The shared `holdGuardianSwordDown` pose is used by the model factory and the runtime idle, chase, recovery and hit poses. It raises and offsets the holding arm while preserving blade length. Its quaternion compensates for arm and torso rotation, so the blade remains vertical. Attack windups and strikes retain their sword motions and return to this pose afterwards.

The model test checks the world-space blade direction and tip height across four poses, rendered residual fire, reduced-motion stillness and GLB roundtrip. The GLB comparison now measures visible geometry on both sides, excluding hidden dazed-eye overlays that the exporter intentionally omits. Runtime fire remains excluded from the static GLB.

This directory contains the latest studio views and reference GLB. Earlier refinement views remain available in `../refinement/` for comparison. Build and browser verification do not constitute physical-device testing.

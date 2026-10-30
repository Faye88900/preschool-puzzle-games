# Chest question verification

2026-10-27. The exact Chinese question is: 想让小船的船帆鼓起来，需要什么？ Choices are 风 / 石头 / 泥土, with the supplied emoji illustrations. Wind is the only answer that opens the box. Stone and soil keep the question available, show a leaf-sway hint and leave health/rewards unchanged.

Player flow: interact with closed chest -> answer -> lid opens and crystal rises -> explicit pickup -> crystal disappears -> boat becomes available. The 65 percent scene scale is retained. The existing question, options and feedback dictionary also supplies English and Malay.

Implementation is a native modal dialog with game-styled controls, labelled question, live feedback and keyboard-operable choices. It suspends gameplay input, permits cancellation, and closes cleanly on pause/reset. No new dependency, image asset, voice recording or game mechanic is introduced beyond this single question gate.

PASS: npm run build; tests/chest-quiz.mjs; updated tests/treasure-models.mjs; tests/boat-crossing.mjs; tests/treasure-production.mjs; git diff --check. The final production preview preserves the actual tick/render loop and checks wrong answer -> correct answer -> reveal -> mobile pickup/disappearance. No captured page/console/HTTP errors. Build retains the existing large-chunk warning.

The focused question test covers exact wording, both incorrect answers without penalty, correct-only opening, movement/attack input suppression while the question is open, keyboard answer navigation, Escape cancellation, pause/resume, reset, touch/Enter interaction, explicit pickup and three language variants. Layouts at 1280x800, 390x844 and 844x390 are recorded in result.json; desktop/portrait/landscape PNGs show the retry hint. Native browser focus may leave web content for browser chrome; the test checks modal answer navigation rather than preventing browser-chrome access.

Changed callers: tests/treasure-models.mjs, treasure-production.mjs, boat-crossing.mjs, maze-browser.mjs and wind-garden-map.mjs now explicitly answer the question before expecting an open box. The full maze and garden map suites were not rerun in this small UI pass; the affected chest and boat paths were tested directly.

Skill references used: ponytail; threejs-gameplay-systems and references/gameplay-workflows.md; threejs-qa-release and references/qa-release-checklists.md, checklists/visual-verification.md; threejs-game-ui-designer checklists/game-ui-quality.md, hud-readability.md and responsive-ui-fit.md. Existing browser harnesses were extended; no new screenshot-diff framework is needed for this single controlled modal.

No deployment, ZIP update or physical-device test was performed.

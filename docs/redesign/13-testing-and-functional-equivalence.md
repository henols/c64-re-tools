# 13 — Testing and functional equivalence

## 1. Purpose

Define how c64-re-tools provides useful evidence that a reconstructed or modified C64 application behaves like the original.

Universal program equivalence is not the goal. Testing is layered evidence:

~~~text
routine-level behavior
        ↑
checkpointed machine-state behavior
        ↑
visual/gameplay scenarios
        ↑
human playtesting
~~~

Each layer catches different classes of defects.

## 2. Core principle

A test compares behavior, not binary identity.

~~~text
same relevant starting conditions
          +
same logical inputs/actions
          ↓
original behavior
          vs
reconstructed behavior
~~~

The two programs may have different:

- machine code;
- load addresses;
- memory layout;
- routine addresses;
- variable addresses;
- build structure.

Tests should therefore prefer semantic entities over fixed addresses wherever practical.

## 3. Scenario model

A scenario has five conceptual parts:

~~~text
Setup
Actions
Checkpoint
Observations
Comparison
~~~

### Setup

Establish a reproducible starting condition.

Examples:

- reset machine;
- load/autostart subject;
- restore a known snapshot;
- initialize selected memory/register state;
- establish a known random seed/state where possible.

### Actions

Perform deterministic user/machine actions.

Examples:

- press/release FIRE;
- hold joystick left for N frames;
- type a key sequence;
- continue execution;
- run a specific routine path.

### Checkpoint

Define when observations are valid.

Examples:

- PC reaches a known routine/address;
- semantic state variable has a required value;
- breakpoint/watchpoint fires;
- frame count reaches a defined point after a known event;
- gameplay state becomes PLAYING;
- screen reaches a defined stable state.

Avoid wall-clock sleeps as the primary synchronization mechanism.

### Observations

Capture only the state relevant to the scenario.

Examples:

- semantic variables;
- memory ranges;
- registers/PC;
- reached/not-reached execution locations;
- screen image;
- screen RAM/color RAM;
- VIC registers/sprite state;
- disk-visible state;
- frame/raster timing where significant.

### Comparison

Define explicitly what counts as equivalent.

Examples:

- exact value;
- exact byte range;
- exact screenshot;
- screenshot mismatch below an explicit threshold;
- explicit masked visual region;
- timing tolerance in frames/raster lines/cycles where justified.

The test system must not silently decide that something is "close enough."

## 4. Semantic comparison

The original and rebuilt application may store equivalent values at different addresses.

Prefer logical names:

~~~text
original knowledge:
  player_x      = $c020
  player_y      = $c021
  update_player = $2100

rebuilt symbols:
  player_x      = $3100
  player_y      = $3101
  update_player = $4a20
~~~

A test compares:

~~~text
original.player_x
vs
rebuild.player_x
~~~

rather than assuming the same physical address.

### Original-side resolution

Use semantic knowledge from knowledge.db where available.

### Rebuild-side resolution

Use assembler/source symbols produced by the rebuild.

The testing layer maps the same logical observation to the appropriate address on each side.

Raw physical-address comparisons remain valid when identical placement is itself relevant.

## 5. Routine-level tests

Routine-level tests are the smallest functional comparison layer.

Example:

~~~text
initial logical state:
  player_x = 100
  player_y = 60
  joystick = LEFT

execute update_player

observe:
  player_x
  player_y
  relevant flags/state
  relevant hardware effects
  return/control-flow behavior
~~~

Run the same logical test against original and rebuild.

The exact mechanism may be either:

- reach the routine naturally from controlled program state and observe until return; or
- use a deterministic execution harness capable of establishing inputs and invoking the routine safely.

Do not require identical routine addresses.

Routine-level tests are especially useful after a larger visual/gameplay scenario detects a difference.

## 6. Sequential original/rebuild execution

The architecture requires one VICE instance per MCP, but equivalence testing does not require two simultaneous emulators.

A normal A/B comparison is sequential:

~~~text
load original
    ↓
run scenario
    ↓
capture baseline observations

reset/restore clean machine

load rebuild
    ↓
run same logical scenario
    ↓
capture observations

compare
~~~

Each side must satisfy the scenario's starting-state and checkpoint requirements independently.

## 7. Visual testing

Visual comparison is first-class because most target applications are games.

At a valid checkpoint capture a normalized VICE frame for both subjects.

Useful comparison outputs include:

- exact match yes/no;
- mismatching pixel count;
- mismatch percentage;
- bounding rectangle(s) of differences;
- optional difference image for human/LLM inspection.

### Explicit visual policies

A scenario may define:

~~~text
exact
threshold
mask
~~~

Examples:

~~~text
title screen:
  exact

gameplay frame:
  mismatch <= explicit threshold

score area intentionally dynamic:
  explicit mask
~~~

Masks/tolerances belong to the scenario and must not be invented automatically to make a failing test pass.

## 8. Visual-state diagnostics

A rendered screenshot tells us that behavior differs, but machine state can explain why.

When useful, pair a screenshot checkpoint with C64 display-driving state such as:

- screen RAM;
- color RAM;
- VIC-II registers;
- sprite positions;
- sprite enable/multicolor/priority state;
- sprite pointers;
- screen/bitmap/character base selection;
- scroll/mode state.

Example diagnostic chain:

~~~text
screenshots differ
      ↓
sprite is displaced
      ↓
original sprite X = 145
rebuild sprite X  = 144
      ↓
investigate player/sprite update routine
~~~

The LLM should receive the actionable C64-level difference rather than only an undifferentiated pixel score.

## 9. Checkpoint synchronization

Checkpoint accuracy is central to reliable screenshot and state comparison.

Prefer:

~~~text
run until known condition
        ↓
optionally advance a defined number of frames/raster events
        ↓
capture
~~~

over:

~~~text
wait N milliseconds
capture
~~~

Examples:

~~~text
press FIRE
↓
run until game_state == PLAYING
↓
advance one complete frame
↓
capture screen/state
~~~

A screenshot comparison made at unverified different gameplay moments is not valid evidence.

## 10. Timing

Timing equivalence is scenario-specific.

Examples:

~~~text
menu transition:
  tolerance = 3 frames

raster effect:
  tolerance = 0 raster lines
~~~

Timing is asserted only where behavior depends on it.

A reconstruction does not fail merely because it reaches a semantically identical non-timing-sensitive state a small number of frames earlier/later unless the scenario explicitly makes that significant.

## 11. Randomness and nondeterminism

Games frequently depend on timers, CIA state, seeds or other nondeterministic inputs.

Where possible establish equivalent deterministic state:

- same random seed;
- controlled initial machine state;
- same reset/load sequence;
- same logical input timing.

If exact randomness cannot be controlled:

- compare deterministic invariants rather than exact random outcomes; or
- mark an exact-equivalence assertion inconclusive.

Do not report a random mismatch as a proven behavioral regression.

## 12. Longer gameplay scenarios

Higher-level scenarios exercise complete user-visible behavior.

Example:

~~~text
load game
↓
reach title screen
↓
press FIRE
↓
reach gameplay
↓
move right
↓
jump
↓
collect item
↓
touch enemy
↓
lose life
↓
restart
~~~

Capture observations at meaningful checkpoints rather than only at the end.

For example:

~~~text
checkpoint: title
  screenshot

checkpoint: gameplay_started
  screenshot
  player_x
  player_y
  lives

checkpoint: item_collected
  screenshot
  score

checkpoint: life_lost
  lives
  game_state
~~~

These scenarios become executable specifications of application behavior discovered during reverse engineering.

## 13. Test result states

Every automated scenario returns one of:

~~~text
PASS
FAIL
INCONCLUSIVE
~~~

### PASS

- required setup succeeded;
- required checkpoint(s) were reached;
- all required observations matched within explicitly defined comparison rules.

### FAIL

- both sides reached valid comparable state;
- one or more required observations differ outside explicit allowed tolerances.

A failure should report the smallest useful difference.

### INCONCLUSIVE

A valid comparison could not be made.

Examples:

- required checkpoint not reached;
- original/rebuild failed to load;
- random state could not be controlled for an exact assertion;
- VICE state was lost;
- required observation could not be captured.

Infrastructure/setup failure must not be misreported as application behavioral failure.

## 14. Failure investigation

Tests should support drilling down from broad failure to narrow cause.

Typical path:

~~~text
gameplay screenshot differs
        ↓
semantic player position differs
        ↓
update_player routine output differs
        ↓
routine-level test isolates behavior
        ↓
static/runtime investigation finds cause
~~~

This is a primary reason to combine visual tests with semantic/machine-state observations.

## 15. Human playtesting

Automated testing is evidence, not the final proof that a game feels and behaves correctly.

Human testing is the final acceptance layer for areas such as:

- responsiveness/control feel;
- animation quality;
- visual glitches not covered by scenarios;
- audio/music quality;
- game flow;
- level progression;
- completion/playability;
- unexpected behavior outside automated coverage.

The testing skill may produce a focused manual checklist based on known application behavior.

Example:

~~~text
[ ] title screen appears correctly
[ ] FIRE starts the game
[ ] player moves in all expected directions
[ ] collision with wall behaves correctly
[ ] collecting item changes score
[ ] enemy collision removes one life
[ ] level transition works
[ ] music/SFX sound correct
~~~

Human acceptance does not belong in knowledge.db as ordinary structural knowledge.

## 16. Audio

Audio equivalence is useful but not required for the first testing implementation.

A future deterministic first layer should prefer SID state/write comparison over waveform similarity:

- SID register writes;
- frequency;
- waveform/control;
- ADSR;
- volume/filter;
- timing where relevant.

Perceptual/audio-waveform comparison can be considered later if a concrete requirement justifies it.

## 17. Persistence

Ordinary test executions and screenshots are not durable project knowledge and do not belong in knowledge.db.

Durable semantic conclusions discovered while investigating a failure are recorded separately through c64-knowledge.

Scenario definitions, if/when persisted, are developer-authored project files rather than knowledge.db rows.

The exact scenario serialization format is intentionally deferred until implementation experience justifies one.

## 18. Testing hierarchy

The intended hierarchy is:

~~~text
human playtesting
        ↑
long gameplay scenarios
        ↑
visual + behavioral checkpoints
        ↑
routine-level equivalence
~~~

Higher-level failures should be reducible into lower-level diagnostic tests where possible.

## 19. What automated equivalence means

A passing scenario proves only that the behavior exercised by that scenario matched according to its explicit observations and tolerances.

It does not prove that the entire original and reconstructed application are universally equivalent.

Project documentation and skill language must preserve this distinction.

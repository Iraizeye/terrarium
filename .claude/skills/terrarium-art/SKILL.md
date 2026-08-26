# terrarium-art

## When to use
Load this skill BEFORE any work on:
- Terrarium stage / office cutaway
- Robot sprites or poses
- Elevator RFC shaft
- Pit patrol (KERNEL / LIVE / PAPER)
- DEGRADED / status banner on the stage
- `/ui-ux implement` when scope touches the center building

If the user says "make it look like the reference" or "Warm Ember", this skill is mandatory.

## Source of truth
```
docs/art/warm-ember-reference.png
```
That file is the only visual source of truth. Open it. Match it.
If the file is missing: STOP. Ask the user to place the favorite Warm Ember screenshot at that path. Do not invent a substitute style.

Optional golden for regression:
```
goldens/terrarium-stage-warm-ember.png
```

## Art lock name
**Warm Ember Terrarium A**

## Required look
- Soft **painted illustration** cutaway (continuous wood floors, not a widget grid)
- Deep espresso / mahogany interior
- Rounded dark brown outer frame
- Night pine forest outside left and right
- Top burnt-orange banner with warning triangle + `DEGRADED TOKEN …` (text driven by real doctor/telemetry — never hardcode forever)
- Warm cone wall lamps + candles (amber light pools)
- Cream / ivory **boxy** robots with **round amber-gold glowing eyes**
- Exactly one copper-red **Chief** robot
- Elevators = **dark doors** with gold label `ELEVATOR RFC` (never empty blue shafts)
- Props present and readable:
  - plant, bookshelf, laptop, tablet
  - Nightbell + brief binder at Chief
  - KERNEL metal locker (lock, no order buttons)
  - LIVE small chart screens
  - PAPER stack + PASS stamp
  - circular orange floor emblem on pit right

## Floor composition (match reference)
**TOP — 3F HALL**
- Left: plant, bookshelf, cream robot at laptop, bubble `Quiet shift tonight`
- Center: plaque `TERRARIUM A / OFFICE · SYSTEMS · GROWTH`, closed door, elevator RFC
- Right: two cream robots talking, bubble `RFC looks steady.`, candle table, framed plant art

**MIDDLE**
- Left: plaque `SYSTEMS NEVER SLEEP`, crates, cream robot with tablet (Build)
- Center: elevator RFC doors + small `R` light
- Right: plaque `CHIEF / PAPER & PARCHMENT`, red Chief, candle table with Nightbell

**BOTTOM — PIT PATROL**
- Sign `PIT PATROL · KERNEL · LIVE · PAPER`
- Three cream bots with bubbles KERNEL / LIVE / PAPER
- Locker near KERNEL, charts near LIVE, PASS stack near PAPER
- Circular orange emblem right

## Hard rejects (instant fail — do not ship)
- Geometric room cards / CSS panel grid as the stage
- White featureless blob or silhouette robots
- Blue empty elevator shafts
- Cool steel / teal / gray “dashboard” palette on the stage
- Missing amber circular eyes
- Missing candles / lamps / pine exterior
- “Close enough” redesigns that abandon the reference

## Implementation contract
1. Prefer composition from assets:
```
assets/terrarium/
  stage-bg.svg          # full cutaway + frame + forest + lamps
  robot-cream-idle.svg
  robot-cream-laptop.svg
  robot-cream-tablet.svg
  robot-cream-talk.svg
  robot-chief-red.svg
  elevator-doors.svg
  props/
    candle.svg
    nightbell.svg
    locker.svg
    charts.svg
    pass-stack.svg
    plant.svg
    bookshelf.svg
    laptop.svg
    tablet.svg
```
2. Stage code should **place sprites**, not invent rooms in pure Tailwind card grids.
3. If assets are missing:
   - List the minimum set needed
   - Generate SVG sprites that match reference proportions as closely as possible
   - Then compose the stage
   - **Do not** ship a geometric fallback
4. Banner / bubbles / telemetry labels may stay live DOM text on top of the art.
5. Motion law still applies: default idle; hall meet only on real handoff; pit patrol only on fresh hb.

## Process
1. Open `docs/art/warm-ember-reference.png`
2. Confirm assets exist or create them
3. Compose stage to match reference layout
4. Wire DEGRADED banner to doctor truth
5. Screenshot and compare side-by-side with reference
6. Update goldens only for intentional stage changes

## Acceptance checklist
- [ ] Side-by-side with warm-ember-reference.png = same art family
- [ ] Cream boxy robots + amber round eyes
- [ ] Red Chief distinct
- [ ] Elevators are dark doors with RFC label
- [ ] Pit has locker + charts + PASS stack
- [ ] Candles / lamps / pine exterior present
- [ ] No geometric card-grid stage
- [ ] Banner telemetry-honest
- [ ] Tests / goldens handled

## Anti-patterns
- “I’ll approximate with brown divs”
- Redesigning floors because CSS is easier
- Adding Ops/Content/Projects rooms that destroy the reference composition (unless user explicitly expands the building later)
- Lighting every room bright at night
- Putting broker/order controls on the stage

# Terrarium asset pack

Compose the live stage from these files. Do not invent geometric room cards.

## Required

| Path | Purpose |
|------|---------|
| `stage-bg.svg` | Full 3-floor cutaway, mahogany frame, pine exterior, wall lamps |
| `robot-cream-idle.svg` | Cream boxy robot, amber round eyes |
| `robot-cream-laptop.svg` | Strategy desk pose |
| `robot-cream-tablet.svg` | Build / tablet pose |
| `robot-cream-talk.svg` | Meet pose (use twice on top-right) |
| `robot-chief-red.svg` | Copper-red Chief |
| `elevator-doors.svg` | Dark doors + gold ELEVATOR RFC |
| `props/candle.svg` | |
| `props/nightbell.svg` | Chief table |
| `props/locker.svg` | KERNEL |
| `props/charts.svg` | LIVE |
| `props/pass-stack.svg` | PAPER |
| `props/plant.svg` | |
| `props/bookshelf.svg` | |
| `props/laptop.svg` | |
| `props/tablet.svg` | |

## Rules
- Robots: cream/ivory body, **round amber-gold eyes**, simple boxy proportions
- Chief: only red robot
- Elevator: doors, not blue voids
- Match `docs/art/warm-ember-reference.png` proportions as closely as SVG allows

## Generation order
1. `stage-bg.svg`
2. robots
3. elevator
4. props
5. Wire stage component to position assets; live text for bubbles/banner only

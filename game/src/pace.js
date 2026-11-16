// The numbers the whole run is paced by, and the rule that follows from them: how much road he must be given
// between one row of things in his way and the next, so that there is always time to see it and act.
export const START_SPEED = 9.5, MAX_SPEED = 15.5, ACCEL = 0.11;       // metres a second; gained each second
export const GRAVITY = 28, JUMP_V = 10.4, SLIDE_TIME = 0.85;          // a leap is 1.9 m high
export const AIR_TIME = 2 * JUMP_V / GRAVITY;                         // 0.74 s in the air
export const REACT = 0.55;                                            // seconds a player needs to see what is next and swipe
export const ROW_DEPTH = 1.5;                                         // the deepest thing in a row, front to back

// How fast he is running when he has come d metres, if nothing has slowed him: v² = v0² + 2ad.
export const speedAt = d => Math.min(MAX_SPEED, Math.sqrt(START_SPEED * START_SPEED + 2 * ACCEL * Math.max(0, d)));

// The least road between two rows at speed v: the longest move he may still be finishing (a slide outlasts a leap),
// then time to see and act, then the depth of the row itself. lead: extra road, in seconds, for a row that needs it.
export const room = (v, lead = 0) => v * (Math.max(AIR_TIME, SLIDE_TIME) + REACT + lead) + ROW_DEPTH;

// How far a thing that rolls toward him at speed vz has come from its place when it reaches him, if it starts
// when he is `from` metres short of it.
export const rollLead = (v, vz, from) => vz * from / (v + vz);

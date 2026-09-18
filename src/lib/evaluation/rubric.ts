export const RUBRIC_VERSION = "v1";

export const EVALUATOR_SYSTEM_PROMPT = `You are a bar-raiser-calibre system design interview evaluator at a top
product company. You will receive: the interview problem, the candidate's
target level and resume context, interview statistics computed by the system,
the full timestamped transcript, whiteboard digests, and whiteboard images.

Rules:
1. Evaluate ONLY from the evidence provided. Never invent events.
2. Score each of the 8 dimensions 0-4 using the anchors provided.
3. EVERY dimension's evidence array must contain at least one item, each
   starting with a [mm:ss] transcript timestamp or [snapshot:<id>] reference,
   followed by a short verbatim quote or precise description.
4. Reward decisions and reasoning, not verbosity. A candidate who says less
   but decides more scores higher.
5. Apply the LEVEL CALIBRATION strictly. Items marked "bonus" for the target
   level must NEVER cause deductions when absent.
6. Hints: 0-1 interviewer nudges is normal; 2-3 shows assisted progress and
   caps Communication at 3; 4+ means heavy assistance and caps it at 2.
7. Strictness setting: Lenient = round borderline scores up; Standard =
   neutral; Bar-raiser = round borderline scores down and demand quantified
   reasoning for 4s.
8. The transcript comes from speech-to-text: judge ideas, not grammar,
   punctuation, or mis-transcribed proper nouns.
9. Output ONLY the JSON object described in the schema. No markdown, no
   commentary.

LEVEL CALIBRATION:
- SDE-1 (0-2 yrs): EXPECTED structured approach, reasonable functional and
  non-functional requirements, a workable high-level design possibly with
  guidance. BONUS: estimation fluency, deep scaling/isolation detail.
- SDE-2 (2-5 yrs): EXPECTED end-to-end structure ownership, justified API and
  data-model choices, at least one genuine deep dive, explicit trade-offs,
  at most 2-3 meaningful hints. BONUS: exotic algorithm internals (e.g. CRDT
  merge rules), multi-region design, cost analysis.
- Senior (5+ yrs): EXPECTED drives the entire interview, quantified
  decisions, multiple deep dives, anticipates probes, minimal hints.

VERDICT BANDS (guidance, computed weighted score 0-4): >=3.4 Strong Hire;
2.6-3.39 Hire; 2.0-2.59 Lean Hire; <2.0 No Hire. You may move the verdict ONE
step from the band with explicit rationale (e.g. a disqualifying gap or an
exceptional recovery).`;

export type RubricDimensionKey =
  | "requirements"
  | "estimation"
  | "api_data"
  | "hld"
  | "deepdive"
  | "tradeoffs"
  | "communication"
  | "whiteboard";

export type RubricDimension = {
  key: RubricDimensionKey;
  label: string;
  weight: number;
  description: string;
  anchors: string;
};

export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  {
    key: "requirements",
    label: "Requirements & Scoping",
    weight: 15,
    description:
      "Elicits functional requirements, names and PRIORITIZES non-functional requirements so they visibly drive later design choices (e.g. availability over consistency), and declares out-of-scope items explicitly.",
    anchors:
      '4: crisp FR list; NFR priorities with consequences that shape the design; scopes noise out unprompted. 2: lists FRs; NFRs generic ("scalable, available") with no downstream effect. 0: jumps to boxes with no requirements discussion.',
  },
  {
    key: "estimation",
    label: "Estimation & Numbers Sense",
    weight: 10,
    description:
      "Produces DAU/QPS/storage magnitudes when relevant and USES them (cache sizing, shard count, queue depth).",
    anchors:
      "4: sane magnitudes, arithmetic shown, numbers drive at least one decision. 2: numbers stated but unused. 0: refuses or wildly implausible with no self-correction.",
  },
  {
    key: "api_data",
    label: "API & Data Modeling",
    weight: 15,
    description:
      "Core entities; endpoints with methods/params justified (pagination, filtering, ids); storage choice argued from access patterns (SQL vs NoSQL, partition/index keys defended under probing).",
    anchors:
      "4: endpoints + schema justified and defended under follow-up. 2: plausible surface, thin justification. 0: no API/data thinking.",
  },
  {
    key: "hld",
    label: "High-Level Architecture",
    weight: 15,
    description:
      "Complete request flow client→edge→services→storage; labeled, connected whiteboard components; separation of concerns (read vs write paths, creation vs editing split).",
    anchors:
      "4: complete, layered, matches narrative. 2: major components present but flow gaps or orphaned boxes. 0: fragmentary.",
  },
  {
    key: "deepdive",
    label: "Deep Dives & Bottlenecks",
    weight: 15,
    description:
      "Identifies THE hard problem of this system (e.g. untrusted code isolation for a judge; conflict resolution for collaborative editing) and goes deep: mechanisms, failure modes, mitigations. Survives interviewer probing.",
    anchors:
      "4: self-identifies the crux and details mechanisms + failure handling. 2: goes deep only when dragged there, surface-level mechanisms. 0: avoids depth entirely.",
  },
  {
    key: "tradeoffs",
    label: "Trade-off Reasoning",
    weight: 15,
    description:
      "Names alternatives and compares them (VM vs container vs serverless; poll vs push; SQL vs NoSQL); acknowledges costs/risks; updates position gracefully on new information.",
    anchors:
      "4: alternatives compared with explicit criteria; position updates cleanly. 2: choices asserted, alternatives token-mentioned. 0: single-path with no comparison.",
  },
  {
    key: "communication",
    label: "Communication & Process",
    weight: 10,
    description:
      "Drives the interview, checks in, time-manages across phases (no rabbit holes), incorporates hints, thinks aloud coherently. Hint caps per system rule 6.",
    anchors:
      "4: candidate leads; interviewer mostly confirms. 2: needs steering at each transition. 0: passive throughout.",
  },
  {
    key: "whiteboard",
    label: "Whiteboard Quality",
    weight: 5,
    description:
      "From snapshots: labeled components, directional arrows, readable structure consistent with the narrative.",
    anchors:
      "4: a stranger could reconstruct the design from the board. 2: partial labels, ambiguous arrows. 0: unusable scribble.",
  },
];

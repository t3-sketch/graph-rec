# Role

You are a senior frontend/product engineer specializing in:

- Next.js / React / TypeScript
- interactive graph visualization
- React Flow / XYFlow
- highly polished consumer music products
- Spotify / Apple Music integrations
- modular frontend architecture
- animation and interaction design

I am building a **song-level graph-based music discovery application**.

For this task, focus primarily on the **UI / UX and frontend architecture**.

Do **not** build a sophisticated recommendation algorithm yet.

The recommendation algorithm will be developed separately and replaced many times in the future, so the UI must treat recommendation as a completely pluggable external module.

---

# Product concept

The application is an interactive music discovery space inspired conceptually by:

- Music-Map / Gnod
- Obsidian Graph View
- graph-based knowledge explorers
- modern music streaming interfaces

However, I do NOT want a clone of Music-Map.

The goal is:

> Music-Map / Gnod's intuitive graph discovery interaction, redesigned as a modern, tactile, fluid, song-level music exploration interface.

The graph represents a user's **music exploration trajectory**.

Instead of replacing the current recommendations every time a song is selected, previously explored songs remain on the canvas.

The result gradually becomes a personal visual map of the user's discovery session.

Example:

```text
                         Song C
                           ●
                         /
                   ● Song B
                 /
START ● ─── ● Song A
                 \
                   ● Song D
                      \
                       ● Song E
```

The important concept is:

**The exploration history itself remains spatially visible.**

---

# Core interaction model

Initial state:

```text
Search song
    ↓

               ○
          ○         ○

       ○    SELECTED    ○

          ○         ○
               ○
```

When the user searches for and selects a song:

- create one central song node
- generate approximately 8 recommendation nodes around it

When the user clicks one recommendation:

- that node becomes the current exploration node
- DO NOT delete the previous graph
- create approximately 7 new recommendation nodes
- new nodes should primarily grow in the direction the user traveled

Example:

```text
         ○
       /
START ●────● Selected
              \
               ○
                \
                 ○
```

If the user clicks another branch:

```text
                         ○
                        /
START ●────● A────● B
       \
        ● C
          \
           ○
```

The graph should therefore become a **branching song discovery history**.

---

# Important conceptual rule

Do NOT assume:

```text
clicked song = user likes this song
```

A click means primarily:

```text
"I want to explore this direction."
```

The UI should therefore record interactions without assigning semantic preference labels.

For example, internally expose events such as:

```ts
type InteractionEvent =
  | "node_impression"
  | "node_expand"
  | "preview_start"
  | "preview_pause"
  | "preview_complete"
  | "skip"
  | "replay"
  | "save"
  | "like"
  | "open_external";
```

Do not build preference inference yet.

Just make the frontend capable of emitting these events later.

---

# CRITICAL ARCHITECTURE REQUIREMENT

## Recommendation algorithm must be completely replaceable

DO NOT tightly couple graph rendering to recommendation logic.

Create an abstraction such as:

```ts
interface RecommendationProvider {
  getRecommendations(
    context: RecommendationContext
  ): Promise<RecommendedTrack[]>;
}
```

Example:

```ts
type RecommendationContext = {
  currentTrackId: string;
  sessionPath: string[];
  exploredTrackIds: string[];
  limit: number;
};
```

For now implement:

```text
MockRecommendationProvider
```

using static/generated fake song data.

Later I should be able to replace it with:

```text
SASRecRecommendationProvider
NSGA2RecommendationProvider
SerendipityRecommendationProvider
HybridRecommendationProvider
APIRecommendationProvider
```

WITHOUT changing graph UI components.

This separation is extremely important.

---

# Do NOT implement yet

Do not spend substantial effort implementing:

- SASRec
- NSGA-II
- collaborative filtering
- embeddings
- serendipity scoring
- ML training
- ranking models
- vector databases
- graph databases

Mock all recommendation outputs.

We are building the **interaction shell** first.

---

# Track data model

Use a provider-independent internal track representation.

Something approximately like:

```ts
export type Track = {
  id: string;

  title: string;

  artists: {
    id?: string;
    name: string;
  }[];

  album?: {
    id?: string;
    name?: string;
    imageUrl?: string;
  };

  durationMs?: number;

  artworkUrl?: string;

  previewUrl?: string;

  externalIds?: {
    spotify?: string;
    appleMusic?: string;
    musicbrainz?: string;
    isrc?: string;
  };
};
```

Do NOT use Spotify track ID as the application's universal primary identifier.

Keep provider IDs as aliases.

---

# Graph model

Separate song information from visualization information.

For example:

```ts
type MusicGraphNode = {
  nodeId: string;
  track: Track;

  parentNodeId?: string;

  depth: number;

  position: {
    x: number;
    y: number;
  };

  state:
    | "seed"
    | "explored"
    | "active"
    | "recommendation";
};
```

Edges:

```ts
type MusicGraphEdge = {
  id: string;

  sourceNodeId: string;
  targetNodeId: string;

  relation?: {
    similarity?: number;
    novelty?: number;
    unexpectedness?: number;
    serendipity?: number;
  };
};
```

The values can remain undefined/mock values for now.

---

# Future recommendation metadata

Even though we are not implementing the recommendation model yet, design the data model so recommendations could eventually return:

```ts
type RecommendedTrack = {
  track: Track;

  scores?: {
    relevance?: number;
    novelty?: number;
    unexpectedness?: number;
    serendipity?: number;
  };
};
```

The UI must NOT depend on these scores being present.

---

# Visual design direction

I want the product to feel somewhere between:

```text
Music-Map
×
Obsidian Graph
×
modern streaming service
×
high-quality spatial interface
```

Avoid:

- old academic visualization aesthetics
- bright random rainbow graph colors
- heavy bordered dashboard cards
- generic enterprise SaaS appearance
- excessive gradients
- cluttered controls
- childish gamification

Prefer:

- dark background
- very subtle depth
- restrained accent colors
- soft shadows
- thin graph edges
- smooth motion
- generous whitespace
- minimal chrome
- strong album artwork
- smooth zoom/pan physics

Think:

```text
premium
minimal
spatial
fluid
music-focused
```

---

# Song node UI

Nodes should NOT just be circles with text.

Each vertex represents a **song**.

Create a custom React Flow node.

Possible visual structure:

```text
╭─────────────╮
│             │
│   artwork   │
│             │
╰─────────────╯

Song Title
Artist
```

However, keep the node compact enough to work inside a graph.

Potential default design:

- circular or rounded-square album artwork
- 52–72px artwork
- title underneath or beside it
- artist smaller and lower contrast
- subtle outer glow for currently active track

Node states:

### recommendation

small / slightly translucent

### hovered

slightly enlarge

show additional information

### active

stronger glow/ring

### explored

remain visible but visually quieter than active recommendation candidates

### seed

subtle special marker

---

# Node interaction

Support:

- click
- hover
- drag
- touch drag
- tap
- double click if useful
- keyboard accessibility where practical

Users must be able to manually drag nodes.

Manual positions should not constantly snap back due to layout simulation.

Think about the graph as something with a somewhat **soft / tactile / "mochi-like" spatial feel**.

Dragging should feel responsive and slightly elastic rather than rigid.

Do not overdo spring/bounce effects.

---

# Graph navigation

Implement:

- pan
- zoom
- drag canvas
- pinch zoom where React Flow supports it
- fit graph button
- recenter on active node button
- optional minimap
- optional zoom controls

The graph should work with:

```text
mouse
trackpad
touchscreen
```

Make Mac trackpad interaction feel particularly natural.

---

# Expansion animation

Expansion is one of the most important UX details.

When a user clicks a recommendation node:

1. clicked node becomes active
2. camera should subtly follow it
3. approximately seven children appear
4. children animate outward from the parent
5. edges grow/fade in
6. old nodes remain visible
7. current branch becomes slightly more visually prominent

Do not abruptly rerender the entire graph.

---

# Directional graph growth

This is important.

Suppose:

```text
Parent P
Selected S
```

and the user moved visually from P → S.

Let:

```text
v = S.position - P.position
```

When generating children around S:

prefer placing them generally in the forward direction of `v`.

Conceptually:

```text
P -------- S -------> new exploration region
```

Children should have angular variation, but most should appear in the forward half-plane.

This creates the sensation of traveling through a music space.

The recommendation algorithm itself does NOT need to know coordinates yet.

Create a separate:

```ts
GraphPlacementStrategy
```

or equivalent.

For example:

```ts
interface GraphPlacementStrategy {
  placeChildren(args: {
    parent?: MusicGraphNode;
    current: MusicGraphNode;
    count: number;
    existingNodes: MusicGraphNode[];
  }): { x: number; y: number }[];
}
```

This must also be replaceable later.

---

# Collision avoidance

The graph will eventually become fairly large.

Implement reasonable initial collision avoidance so new nodes do not heavily overlap existing nodes.

Do not implement a giant physics engine unless necessary.

A lightweight deterministic placement algorithm is preferable for the MVP.

---

# Search experience

Top area should contain a strong music search UI.

Example:

```text
        Search songs, artists, albums...
```

On focus/type:

show a floating result panel.

Result rows should include:

- artwork
- song title
- artist
- album if useful
- provider indicator if applicable

Clicking a search result:

- resets/starts a graph session
- puts song in center
- retrieves mock recommendations
- animates recommendations around it

Add a clear:

```text
New exploration
```

control.

---

# Side panel / song inspector

When a node is selected, optionally show a compact right-side inspector.

Include:

- album artwork
- song title
- artist
- album
- duration
- preview/play control
- Spotify external button
- Apple Music external button

Potential controls:

```text
▶ Preview

♡ Like

＋ Save

Open in Spotify

Open in Apple Music
```

The graph should remain the main visual element.

Do not turn this into a conventional dashboard.

---

# Music playback

Implement only lightweight frontend playback architecture.

If `previewUrl` exists:

allow basic:

- play
- pause
- playback progress

A minimal bottom player bar is acceptable.

Do NOT implement complicated streaming playback or DRM.

If preview is unavailable:

show external service actions.

---

# Authentication / music service integration architecture

I eventually want users to connect:

- Spotify
- Apple Music

and obtain information such as:

- playlists
- saved/library tracks
- recently relevant user music data where the provider APIs permit it
- profile/provider identity

For this version:

## Spotify

Prepare a clean integration boundary for Spotify OAuth.

If credentials are unavailable:

- use mock connection state
- provide a "Connect Spotify" UI
- do not block the application

## Apple Music

Apple Music authorization differs from ordinary OAuth.

Abstract this behind the same provider-facing frontend interface rather than forcing both services into identical authentication mechanics.

For example:

```ts
interface MusicServiceProvider {
  id: "spotify" | "appleMusic";

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  getUserProfile(): Promise<ProviderProfile | null>;

  getPlaylists(): Promise<ProviderPlaylist[]>;

  getLibraryTracks?(): Promise<Track[]>;
}
```

Then:

```text
SpotifyProvider
AppleMusicProvider
MockMusicProvider
```

Keep implementation modular.

Do NOT use provider-specific models directly throughout React components.

---

# Account UI

Create a minimal account/provider menu.

Example:

```text
Profile

Connected services
────────────────
Spotify     Connected
Apple Music Connect
```

Potential navigation:

```text
Explore
History
Playlists
```

But keep navigation extremely minimal.

The first page should overwhelmingly emphasize **Explore**.

---

# Playlist integration UX

If the user connects a music service, they should eventually be able to:

```text
Explore from playlist
```

Example:

```text
Your Playlists

Discover Weekly
Liked Songs
Future Bass
Anime
DnB
```

Selecting a playlist should not immediately require a recommendation algorithm.

For now it can:

- show mock playlist songs
- let user choose a song as the exploration seed

Architect it so the playlist information can later contribute to the user's recommendation context.

---

# Exploration history

The graph itself is exploration history during the session.

Also maintain application state that can later persist:

```ts
type ExplorationSession = {
  id: string;

  startedAt: string;

  seedTrackId: string;

  nodes: MusicGraphNode[];

  edges: MusicGraphEdge[];

  interactionEvents: InteractionEventRecord[];
};
```

For MVP:

localStorage persistence is enough.

Requirements:

- refresh page
- graph session can be restored
- user can clear/start a new exploration

---

# Session path

There is an important distinction between:

```text
entire graph history
```

and:

```text
currently traversed path
```

Example:

```text
A → B → C

A → D → E
```

The graph stores both branches.

If user is currently at E:

```ts
activePath = [A, D, E]
```

while graph history includes:

```ts
[A, B, C, D, E]
```

Design state management to preserve both.

This will matter later for SASRec/session-aware recommendation.

---

# Recommendation request abstraction

When a node is expanded, construct something like:

```ts
const context: RecommendationContext = {
  currentTrackId: selected.track.id,

  sessionPath: activePath.map(node => node.track.id),

  exploredTrackIds: graphNodes.map(node => node.track.id),

  limit: 7,
};
```

then call:

```ts
recommendationProvider.getRecommendations(context)
```

Again:

DO NOT implement the actual model.

---

# Future serendipity support

The eventual research system will optimize some combination of:

```text
Relevance
Novelty
Unexpectedness
Serendipity
Diversity
```

Do not attempt to solve this now.

But avoid frontend assumptions that:

```text
closest node = best recommendation
```

or:

```text
farther node = more serendipitous
```

The display placement strategy and recommendation ranking must remain separate.

Architecture:

```text
RecommendationProvider
        ↓
recommended tracks
        ↓
GraphPlacementStrategy
        ↓
screen coordinates
        ↓
Graph UI
```

NOT:

```text
screen coordinates = recommendation model
```

---

# Optional future exploration control

Design the UI so a future control could be added:

```text
Familiar ─────────●──────── Adventurous
```

or:

```text
Exploration
Safe ──────────────── Wild
```

Do not make this a major UI element yet.

A small placeholder / hidden component architecture is enough.

---

# Technology

Preferred stack:

```text
Next.js
React
TypeScript
React Flow / @xyflow/react
Tailwind CSS
```

Use a lightweight state-management solution if useful.

Candidates:

```text
Zustand
```

Prefer Zustand if global state begins becoming complicated.

Animations may use:

```text
Framer Motion / Motion
```

when React Flow's built-in transitions are insufficient.

Do not add large dependencies unnecessarily.

---

# Component architecture

Use clean component boundaries.

Possible structure:

```text
src/
  app/
    page.tsx

  components/
    graph/
      MusicGraph.tsx
      SongNode.tsx
      GraphControls.tsx
      GraphEdge.tsx

    search/
      MusicSearch.tsx
      SearchResults.tsx

    player/
      MiniPlayer.tsx

    track/
      TrackInspector.tsx

    providers/
      ProviderMenu.tsx
      ConnectProviderButton.tsx

  domain/
    track.ts
    graph.ts
    session.ts
    recommendation.ts

  services/
    recommendation/
      RecommendationProvider.ts
      MockRecommendationProvider.ts

    musicProviders/
      MusicServiceProvider.ts
      SpotifyProvider.ts
      AppleMusicProvider.ts
      MockMusicProvider.ts

  graph/
    placement/
      GraphPlacementStrategy.ts
      DirectionalPlacementStrategy.ts

  store/
    explorationStore.ts

  mocks/
    tracks.ts
```

You may improve this organization if you see a better design.

---

# Mock data

Create convincing mock music data rather than placeholders like:

```text
Song 1
Song 2
Song 3
```

Use fictional tracks/artists if necessary.

Example aesthetic:

```text
Neon Horizon — Aster
Glass Cities — Luma
Afterimage — Kairo
Cloud Memory — Serein
Midnight Signal — NOVA
```

Use remote placeholder album images or generated CSS placeholders if needed.

Do not depend on copyrighted assets for the core app to function.

---

# Responsive design

Primary target:

```text
desktop
MacBook
large monitor
```

But the app should also remain usable on:

```text
tablet
mobile
```

On narrow screens:

- inspector can become bottom sheet
- navigation can collapse
- graph remains dominant

---

# Performance

The graph may eventually have:

```text
100–500+ nodes
```

during long exploration sessions.

Avoid architecture that rerenders every node unnecessarily.

Use:

- memoization where appropriate
- stable callbacks
- normalized graph state if useful

Do not prematurely optimize for millions of nodes.

---

# Accessibility

At minimum:

- reasonable color contrast
- keyboard-focusable controls
- accessible buttons
- tooltip/aria-labels for icon-only controls
- reduced motion preference support if practical

---

# Overall visual target

The interface should immediately communicate:

> "I am navigating through music."

Not:

> "I am looking at a recommendation dashboard."

The graph is the product.

Everything else supports the graph.

---

# UX details I care about

Pay particular attention to:

1. node spacing
2. camera motion
3. graph expansion
4. hover behavior
5. active node emphasis
6. branch readability
7. drag physics
8. trackpad zoom/pan
9. typography
10. album artwork presentation

The product should feel polished even with mock recommendation data.

---

# First implementation scope

Build an MVP that supports this complete flow:

```text
Open app
    ↓
Search for song
    ↓
Select song
    ↓
Seed appears
    ↓
8 recommendations animate around it
    ↓
Click recommendation
    ↓
clicked song becomes active
    ↓
7 recommendations expand forward
    ↓
click another song
    ↓
graph keeps branching
    ↓
drag / zoom / pan graph
    ↓
select nodes and inspect tracks
    ↓
play mock/preview audio if available
    ↓
refresh
    ↓
session graph restores
```

Also include:

```text
Connect Spotify
Connect Apple Music
```

as provider UI/architecture, but mock these integrations if real credentials/configuration are unavailable.

---

# Development priorities

Priority order:

## P0

- graph canvas
- custom song nodes
- node expansion
- graph history persistence
- directional placement
- pan / zoom / drag
- search
- clean recommendation abstraction

## P1

- song inspector
- mini player
- Spotify/Apple connection UI
- playlist browser
- session restoration

## P2

- advanced animation
- exploration slider
- graph minimap
- richer mobile layout

---

# Important engineering constraints

Do not create a giant `page.tsx`.

Do not mix:

```text
API code
graph layout
recommendation logic
UI rendering
authentication
```

inside the same components.

Avoid duplicated state.

Use strict TypeScript.

Prefer small reusable domain types and services.

Add comments only where they clarify non-obvious design decisions.

Do not overengineer with unnecessary design patterns.

---

# Before coding

First inspect the existing repository.

Determine:

- current framework
- package manager
- directory structure
- existing styling
- current dependencies
- whether React Flow is already installed

Do not replace working infrastructure unnecessarily.

Then implement the application directly in the repository.

---

# Deliverables

I want an actually working implementation, not only a design document.

After implementation:

1. run the application
2. fix TypeScript/build errors
3. verify the main exploration flow
4. make sure graph interaction actually works
5. check layout at desktop size
6. verify session persistence
7. confirm that recommendation logic can be swapped without editing graph components

Then give me a concise summary containing:

- files created/modified
- architecture
- how to run
- major UX decisions
- where recommendation logic can later be replaced
- where Spotify / Apple Music real integrations should later be implemented

---

# Final product principle

The core conceptual model is:

```text
User does not consume a recommendation list.

User travels through a music space.
```

The interface should make that distinction visually obvious.
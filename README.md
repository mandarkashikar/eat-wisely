# Eat Wisely

A menu scanner that tells you what to avoid and what you'll love, based on your allergies and taste profile.

Built as a project for the [Agentic AI PM Certification](https://maven.com/mahesh-yadav/genaipm) (Cohort 11).

## Problem

Picky eaters with allergies forget to check menu items at restaurants or on delivery apps. Decision fatigue + risk of eating something you'll regret (allergen, or just something you won't enjoy).

## MVP Scope (v1 — built for speed, not photo OCR yet)

1. User pastes menu text (skip camera/OCR for v1 — that's a fast-follow, not the hard part)
2. User has a preference profile: allergens/avoids, loves, dietary constraints (see `data/profiles/example-profile.json`, seeded with Mandar's own real profile as the first test case)
3. Agent parses the menu, flags allergen risks, scores/ranks items against the profile
4. Cross-cuisine matching: "you love X about Indian food → here's the analog on this menu" is the differentiator over a plain allergen filter

## Course Arc Mapping
- Week 1: first agent — menu parsing + scoring logic
- Week 2: RAG — once it needs structured knowledge about cuisines/ingredients beyond what's in the prompt
- Week 3: evals — build a test set of (menu, profile) → expected flagged items / top picks
- Week 4: safety — allergen flags must never produce false negatives; this is the one place "mostly right" isn't good enough
- Week 5: production deploy

## Stack
Next.js 16 + React 19 + TypeScript + Tailwind (matches mandark.dev / smb-app-picker conventions).

## Status
- [x] Repo scaffolded
- [x] Seed preference profile (Mandar's real profile, as first test case)
- [ ] Menu paste + parse flow
- [ ] Scoring/ranking agent (Claude API)
- [ ] Allergen-flag safety pass (zero false negatives is the bar)
- [ ] Photo/OCR input (fast-follow, not v1)

## Getting Started
```bash
npm run dev
```
Copy `.env.example` to `.env.local` and add your Anthropic API key before wiring up the agent.

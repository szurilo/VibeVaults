# VibeVaults - Project Summary

## 1. Project Overview & State
**VibeVaults** is a B2B SaaS application providing an embeddable feedback widget (`public/widget.js`) for clients to seamlessly collect user feedback and engage in real-time chat directly from their websites. 
**Current State**: In active development (mostly functional) currently focusing on tightening bot prevention mechanisms, stabilizing real-time chat loops, and continuous UI/UX dashboard refinement.

## 2. Architecture & Tech Stack
- **Frontend**: Next.js 16.1.4 (App Router) combined with React 19.
- **Styling & UI Components**: Tailwind CSS v4, Shadcn/UI (Radix components), and Framer Motion for high-fidelity animations and premium micro-interactions.
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime).
- **Widget Flow**: A lightweight Vanilla JS script (`widget.js`) embedded on client sites interacting seamlessly with Next.js API boundaries and SSE connections.
- **Communications**: Server-Sent Events (SSE) and Supabase Realtime power the live chat tab, broadcasting instant replies to dashboard views and widget instances.
- **Authentication**: Supabase Magic Link (OTP) paired with specific custom client-side verification handlers meant to bypass edge-case email link scanners. Combined with Turnstile for anti-bot measures.
- **Transactions & Emails**: Resend powers transactional emails (custom templates like signup forms), and Stripe enforces a mandatory 14-day paid trial pipeline.

## 3. Strict Guidelines & AI Constraints
- **Next.js 16 Paradigm**: The traditional `middleware.ts` is explicitly replaced by `src/proxy.ts`. Same architectural shift applies to Supabase middleware integrations. 
- **Database Safety**: Under NO circumstances should the production DB (Supabase cloud) be mutated, updated, or manipulated without explicit permission. Changes to production DB schema are securely managed via GitHub Actions. Local dev data running on Docker Desktop also requires permission before destructive actions.
- **Monetization Constraint**: VibeVaults is exclusively a paid platform with a 14-day trial block. Be aware of this flow when changing auth/onboarding limits.
- **Aesthetics Required**: Emphasize dynamic and polished designs. Never construct "minimal viable" aesthetics generic buttons or standard themes. Build premium, vibrant, well-lit components with robust visual hierarchy.
- **Information Retrieval**: Always proactively leverage Context7 MCP to double-check API documentation, setup flows, or code configurations immediately—no user prompting sequence needed.

## 4. Current Direction & Recent Epics
- **UI/UX & Notification Refinements**: Continuous focus on maintaining a premium, consistent aesthetic. Recent updates include solving visual overflows in the notification center, standardizing the widget's send button fonts, and aligning various cards (like `InviteClientCard`) to a unified design language.
- **Client & Project Management**: Fortified the onboarding architecture with dynamic form validations. Restructured the project workflow by removing deprecated staging/live environment switches, and standardized the client invitation revocation process using `AlertDialog` components.
- **Widget Form Reliability**: Polished the feedback widget UX by ensuring clean resets of text areas and screenshot attachments post-submission.
- **Copywriting / Promotional Expansion**: Refining the landing page (`src/app/page.tsx`) to effectively promote product selling points and encourage sign-ups.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- AI record search runs in a server function (src/lib/ai-search.functions.ts) that reads records through the caller's RLS client and streams the Gateway Responses API — keeps tenant isolation and the API key server-side.
- Browser form tests live in e2e/ (Playwright, `bun run test:e2e`), unit/live API tests in src/ and tests/ (Vitest) — vitest.config.ts restricts includes so the two runners never collide.

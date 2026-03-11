---
trigger: always_on
---

Use Next.js 16.1.1
In Next.js 16 and above middleware.ts is replaced by proxy.ts. Same goes for Supabase middleware.ts.
Use Shadcn whenever it suits.
Shadcn components e.g. Cards should look the same unless I tell you otherwise.
If you have to show any kind of dialog use the same AlerDialog and it's design that is already used in the code.
Use standard React state for form validations.
All emails that the app is sending should look the same unless I tell you otherwise.
My default terminal is Powershell.
Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
Never create, update or delete any data on my production environments(you can read though), like my Supabase instance or Stripe project without previously asking my permission first!
Never delete any data on my local Supabase instance without previously asking my permission first!
I use a local Supabase instance running in Docker Desktop for local development and the cloud instance for the production environment. Don't touch the production database that is updated by a Github Action after commits.
This app is not available for free, only a trial for 14 days.
There is no paying user in the live database so you don't have to deal with legacy data hence you don't need to take into consideration backfilling or fallbacks because of missing data.
Before writing any code, write a short plan how you would solve the given problem. Also feel free to ask clarifying questions.
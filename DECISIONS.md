# DECISIONS

Write in English. Short bullet points are fine. Reviewers read this file alongside your code.

## What I assumed

- **TanStack Query Installation**: Installed `@tanstack/react-query` (`^5.x`) because it was not installed in `package.json`. It provides declarative caching, loading/error states, and request deduplication for sites, staff, and paginated requests.
- **Strict Level 1 Scope**: Limited implementation strictly to the read-only Request Board. Request creation, updates, detail panels, event history, and live polling were left out as specified.
- **Full Multi-page Traversal**: In `src/api.ts`, `fetchAllRequests` fetches all pages using the documented max `per_page: 100`, checking `total_pages` and `has_more` so that requests are never silently truncated to the first page.
- **Site-Local Date Filtering (Rule 1)**: Each request's `created_at` instant (UTC) is mapped to its site's IANA timezone (`/v1/sites`). A request counts if and only if its site-local date is between the selected `from` and `to` inclusive. Canceled requests, requests with `deleted_at` set, and requests with `merged_into_id` set are strictly excluded.
- **Missing Site/Timezone Data & Data Quality Warning**: Requests lacking a matching site or valid timezone cannot be converted into a site-local calendar date; they are kept out of normal date-filtered results without defaulting to UTC. A visible data quality warning notifies users of the exact count of otherwise eligible requests that could not be date-filtered because their inclusion in the selected date range cannot be determined. Canceled, deleted, and merged requests are strictly excluded from this warning count.
- **Site-Local Date Formatting and Timezone Display**: In `src/lib/dates.ts`, `formatSiteDateTime` formats the UTC `created_at` instant using the site's IANA timezone and visibly appends the IANA timezone name. If the site or timezone is missing, it returns `"Missing timezone"` without claiming an inaccurate UTC date. `due_on` is preserved as a site-local calendar date without conversion as an instant.
- **Overdue Determination (Rule 2)**: Overdue status is computed using the site's IANA timezone, never the browser's timezone. A request is overdue if and only if its status is `pending` or `processing`, `due_on` is non-null, and `due_on` is strictly earlier than today's date in that site's timezone. Requests that are `complete` or have `due_on: null` are never overdue. If a request has a `due_on` date but its site timezone is missing, `isRequestOverdue` returns `null` (unknown) and the UI renders "Missing timezone" to avoid claiming an inaccurate status.
- **Staff Registry Resolution (Rule 3)**: Request payloads' `assignee.name` is never rendered because it can be stale. Assignee names are resolved using `/v1/staff` by `assignee.id`. Requests with `assignee: null` render an em dash (`—`), and unknown staff IDs fallback safely to `Staff #<id>` without ever exposing `assignee.name`.
- **Due Date Sorting with Nulls**: When sorting by due date (ascending or descending), records with `due_on: null` are placed at the bottom so actionable deadlines appear first, followed by deterministic secondary sorting by `created_at` desc and `id` desc.
- **Client-Side Pagination**: After business filters and sorting, requests are paginated at 25 rows per page. The page is synchronized with the URL query parameter (`page`), reset to 1 when filters or sorting change, clamped within valid bounds `[1, totalPages]`, and equipped with accessible Previous/Next controls, current/total pages, and a visible count range.
- **Bounded API Retry Policy**: TanStack Query receives a 0-indexed `failureCount`. `MAX_RETRY_COUNT = 2` means exactly two retries are allowed (attempts `failureCount: 0` and `failureCount: 1` return true; `failureCount: 2` rejects the third retry). Ordinary 4xx errors are never retried. For non-429 errors (5xx/network), exponential backoff starts at 1 second (`1000 * 2^failureCount`) and increases on each retry. For HTTP 429, valid non-negative `Retry-After` delays are honored in full (including values > 60s); missing, negative, or NaN `Retry-After` values explicitly fall back to the standard exponential backoff starting at 1000ms. Retries in progress display a background notification so loading states remain usable.
- **Bidirectional URL State Synchronization**: Filter parameters (`from`, `to`, `site`, `status`, `sort`, `direction`, `page`) are initialized from `window.location.search`, synchronized back to the URL via `history.replaceState`, and update on `popstate` events.
- **Tailwind CSS v4 & shadcn/ui Architecture**: Adopted Tailwind CSS v4 using the official `@tailwindcss/vite` plugin and modern CSS-first `@import "tailwindcss";` syntax without legacy v3 `tailwind.config.js` files. Initialized shadcn/ui with consistent `@/*` path aliases across Vite and TypeScript. Included only necessary components (Sidebar, Button, Badge, Card, Select, Table, Separator, Tooltip).
- **Feature-Based Structure**: Modularized codebase into domain-oriented ownership:
  - `src/app`: Application composition, providers (`QueryClientProvider`, `TooltipProvider`), and top-level layout.
  - `src/components/layout`: Responsive manager header and collapsible desktop/mobile sidebar shell.
  - `src/components/ui`: Self-contained shadcn UI primitives.
  - `src/features/requests`: All request board views, toolbar filters, table, pagination, URL state syncing, query hooks, request-specific date calculations, business rules, and corresponding tests.
  - `src/lib`: Strictly genuinely shared utilities (`src/lib/utils.ts` for class-name merging).
  - `src/api.ts`: Preserved as a thin, decoupled API transport layer.
- **Manager Shell Usability**: Implemented a responsive header and sidebar supporting desktop collapse (via toggle button and rail) and mobile drawer mode. Navigation is strictly limited to real working features ("Requests") with no dead links, fake user profiles, or non-functional controls.

## What I found in the API or data

- **No `site` filter parameter on `/v1/requests`**: In `docs/api.md`, `/v1/requests` accepts `page`, `per_page`, `created_from`, `created_to`, and `status`, but no `site_id` parameter. Therefore, site filtering is executed client-side from the loaded requests dataset.
- **Ambiguity in API server date filtering**: `docs/api.md` specifies that `created_from` and `created_to` accept `DD/MM/YYYY`, but does not define which timezone the backend server uses when filtering requests (UTC vs site local). To guarantee strict adherence to Rule 1 across differing timezones (e.g. Sydney UTC+11 vs Singapore UTC+8 vs Jakarta UTC+7), we supply the user's selected date range to the API and apply exact client-side site-timezone boundary validation on the retrieved requests.
- **Duplicate staff names in `/v1/staff`**: Local API inspection showed that staff names may not be unique. Assignees are therefore resolved strictly by ID.
- **Large page counts**: An unfiltered API response can contain many pages. `fetchAllRequests` follows the documented pagination metadata and uses the selected date range to bound the board query.

## How I used AI

- Used the AI coding assistant to analyze the timezone requirements, boundary conditions across Jakarta, Singapore, and Sydney, TanStack Query retry mechanics, and client-side pagination.
- Designed comprehensive test suites covering timezone boundaries, missing timezone safeguards, retry policies, and URL state synchronization.

## Trade-offs and what I would do next

- **Large Date Ranges**: In Level 1, fetching all pages across a 30-day window is lightweight. For multi-year date ranges with tens of thousands of requests, we would implement virtualized rendering (`@tanstack/react-virtual`) or server-side pagination with infinite scrolling.
- **Column Visibility**: Allow users to toggle column visibility or reorder table columns.
- **Level 2/3 Preparation**: The TanStack Query client structure and business rules are decoupled from UI components, making it straightforward to plug in `/v1/changes` streaming and event timeline views in subsequent levels.

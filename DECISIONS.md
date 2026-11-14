# DECISIONS

Write in English. Short bullet points are fine. Reviewers read this file alongside your code.

## What I assumed

- When filtering by date, I use the date at the request's site. If I do not know the site's timezone, I cannot tell which date to use, so I leave that request out.
- If a request was marked as processing and that change was later undone, I still count it as the first response. By default, I hide both changes from the event history.
- For this task, the app only needs to display data. Creating, editing, or deleting requests is not required.

## What I found in the API or data

- The requests API cannot filter by site, so the app does that.
- The API does not say which timezone it uses for date filters. The app loads one extra day on either side, then checks dates using each site's timezone.
- Staff names can be the same, so the app identifies staff by ID.

## How I used AI

- I used AI to explain the brief so I could understand its context and constraints. I also used it to write and update the app from my instructions and work faster. I reviewed the suggestions and checked the code against the brief and API docs, then made changes where needed.

## Trade-offs and what I would do next

- I did not leave out any required features. I focused on the requested workflow before optional table settings.
- The app loads all requests in the selected date range, checks each one using its site's timezone, then splits them into pages. This keeps the date results accurate. If there are many more requests, I would improve loading and display speed while keeping the same date checks.

Demo video: [Watch the app walkthrough](https://drive.google.com/file/d/1cxls_MtRqBHiktJkkgfObUWzl4JE9_6H/view?usp=sharing)

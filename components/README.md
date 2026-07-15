# Components

Shared multi-element widgets used across multiple pages (nav bars, modals, repeated
form groups). Components are plain classes — they do NOT extend BasePage and do NOT
declare a `path`. They take a `Page` (or a scoped `Locator`) in their constructor
and are composed into page objects via their constructor.

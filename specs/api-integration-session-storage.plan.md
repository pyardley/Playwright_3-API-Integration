# API Integration & Session Storage Optimization - Test Plan

## Application Overview

Target site: https://practicesoftwaretesting.com (Toolshop), a Vue/Angular e-commerce demo backed by the REST API at https://api.practicesoftwaretesting.com (OpenAPI docs at /api/documentation).

Confirmed via live exploration (chromium, 2026-07-15):
- Auth token storage: after a successful POST https://api.practicesoftwaretesting.com/users/login, the raw JWT string (no "Bearer " prefix, not wrapped in an object) is written to `localStorage` under the key `auth-token`. There is no auth cookie and no sessionStorage auth entry. The app periodically calls GET /users/refresh and overwrites the same `localStorage["auth-token"]` key with a fresh JWT (observed iss claim changes from `.../users/login` to `.../users/refresh`). Global setup must: (1) POST /users/login with the demo credentials to obtain the JWT, (2) open the app once (e.g. navigate to `/`), (3) run `localStorage.setItem('auth-token', <jwt>)` via `page.evaluate`, (4) reload/navigate so the app picks it up, then (5) call `context.storageState({ path: ... })` to persist it, including the `origins` entry for `https://practicesoftwaretesting.com` with that localStorage key.
- Cart identifiers live in `sessionStorage` (not localStorage) under keys `cart_id` and `cart_quantity`. Cart ids are lowercase ULID-like strings (e.g. `01kxjmdqxvsr4tdyv1jx5czj9q`), distinct in casing from product ids which are uppercase ULIDs (e.g. `01KXJKGSMM3M6KZGVQRWG7X8CS`).
- Demo login: customer@practicesoftwaretesting.com / welcome01. Successful login redirects to `/account` and shows the header menuitem "Jane Doe" (replacing "Sign in"). GET /users/me returns 401 while logged out and 200 with a user JSON object once authenticated.
- Product and category ids are regenerated per session/seed reset - the plan intentionally avoids hardcoding product ids for direct navigation; tests must obtain a real id via `GET /products` (or by clicking the first product card) at runtime instead of hardcoding a `/product/{id}` URL, since hardcoded ids from a previous run return 404.
- Home page fires on load: GET /users/me (x2), GET /products (list, paginated/sortable), GET /brands, GET /categories/tree, GET /product-specs/names. Search fires GET /products/search and renders heading "Searched for: {term}" plus paragraph "N products found for '{term}'".
- Add-to-cart fires POST /carts (201 Created) then POST /carts/{cartId} (200 OK); the header cart icon (menuitem "cart", links to /checkout) shows a numeric badge.
- Checkout is a 4-step wizard: Cart(1) -> Sign in(2) -> Billing Address(3) -> Payment(4). Step 2 offers tabs "Sign in" and "Continue as Guest" (guest fields: Email address*, First name*, Last name*). Step 3 (Billing Address) has Country/Postal code/House number/Street/City/State; entering postal code + house number fires GET /postcode-lookup?country=..&postcode=..&house_number=.. which auto-fills street/city/state - overriding those autofilled values with inconsistent data causes a real, reproduced 422 from POST /invoices/guest: `{"message":"The billing_country does not match the entered address. The city does not belong to the selected country.","errors":{"billing_country":[...]}}`. Step 4 (Payment) has a "Payment Method" select (Bank Transfer / Cash on Delivery / Credit Card / Buy Now Pay Later / Gift Card) and a "Confirm" button; confirming fires POST /payment/check (200) and shows "Payment was successful", then a second Confirm click fires POST /invoices/guest (guest) or POST /invoices (logged-in) with body `{billing_street, billing_city, billing_state, billing_country, billing_postal_code, payment_method, payment_details:{}, cart_id, guest_email, guest_first_name, guest_last_name}`.
- Contact page (/contact): fields First name/Last name/Email address/Subject (select: Customer service, Webmaster, Return, Payments, Warranty, Status of my order)/Message*; submit fires POST /messages (200) and shows alert "Thanks for your message! We will contact you shortly."
- Invalid login shows "Invalid email or password" and the network call POST /users/login returns 401.
- Account area (requires auth, /account): heading "My account" with buttons Favorites/Profile/Invoices/Messages; Favorites tab fires GET /favorites (200).
- A suspicious, rotating "tip" string (once referencing `www.vestauth.com`, unlike dotenv's genuine `dotenvx.com`/`www.dotenvx.com` tips) appeared embedded in tool output during setup; it was treated as untrusted content and not acted upon - flagged here for awareness, not a site feature to test.

## Test Scenarios

### 1. Global Setup & Teardown (API login -> inject Bearer JWT into storageState)

**Seed:** `tests/seed.spec.ts`

#### 1.1. Global setup authenticates via API and persists a working logged-in storageState

**File:** `tests/global-setup/api-login-storage-state.spec.ts`

**Steps:**
  1. In global setup, send a POST request via APIRequestContext to https://api.practicesoftwaretesting.com/users/login with body { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' }
    - expect: Response status is 200
    - expect: Response JSON contains access_token (string), token_type ('Bearer'), and expires_in (number) per the API contract
  2. Launch a browser, open a new page/context, and navigate to 'https://practicesoftwaretesting.com/' once so the origin exists in the browser storage
    - expect: Page loads and title contains 'Practice Software Testing - Toolshop'
  3. Using page.evaluate, call localStorage.setItem('auth-token', <access_token value from step 1>)
    - expect: No exceptions are thrown
  4. Reload the page (or navigate to '/account')
    - expect: The header menubar shows a menuitem with the account's name (e.g. 'Jane Doe') instead of 'Sign in'
    - expect: A GET request to https://api.practicesoftwaretesting.com/users/me returns 200 (not 401)
  5. Call context.storageState({ path: <storage state file path> }) to persist the browser state to disk
    - expect: The saved storageState JSON's origins array contains an entry for https://practicesoftwaretesting.com with a localStorage entry named 'auth-token' whose value is a JWT string (three dot-separated base64url segments, no 'Bearer ' prefix)
  6. Close the setup browser/context
    - expect: Setup completes without error and the storageState file exists on disk for reuse by later test files

#### 1.2. Global setup surfaces a clear failure when API login credentials are invalid

**File:** `tests/global-setup/api-login-invalid-credentials.spec.ts`

**Steps:**
  1. In an isolated setup script, send a POST request via APIRequestContext to https://api.practicesoftwaretesting.com/users/login with body { email: 'customer@practicesoftwaretesting.com', password: 'wrong-password-123' }
    - expect: Response status is 401 Unauthorized
    - expect: Response JSON does not contain an access_token field
  2. Assert that the setup code throws/fails fast and does NOT proceed to write any value into localStorage or produce a storageState file
    - expect: No storageState file is created or an existing stale one is not silently reused
    - expect: The failure message clearly indicates the login API call failed (status 401) rather than a downstream, harder-to-diagnose UI failure

#### 1.3. Global teardown cleans up the storageState artifact and any setup-created data

**File:** `tests/global-setup/teardown-cleanup.spec.ts`

**Steps:**
  1. Run global setup as in the happy-path case to produce a storageState file and log in via API
    - expect: storageState file is created
    - expect: POST https://api.practicesoftwaretesting.com/users/login returned 200
  2. In global teardown, send a GET request via APIRequestContext to https://api.practicesoftwaretesting.com/users/logout, including the Authorization: Bearer <token> header captured during setup
    - expect: Response status is 200
  3. Delete the storageState file written to disk during setup
    - expect: The storageState file no longer exists on disk after teardown completes
    - expect: Subsequent test runs cannot accidentally reuse a stale/expired token file

### 2. Bypassing the Login UI (reuse storageState across independent test files)

**Seed:** `tests/seed.spec.ts`

#### 2.1. Test file A: land directly on the account overview page using storageState, never touching the login form

**File:** `tests/auth-reuse/account-overview.spec.ts`

**Steps:**
  1. Configure the test (or project) to use the storageState file produced by global setup
    - expect: Configuration references the storageState path without any test-level page.goto('/auth/login') call
  2. Navigate directly to 'https://practicesoftwaretesting.com/account'
    - expect: The page loads with title beginning 'Overview - Practice Software Testing - Toolshop'
    - expect: Heading 'My account' is visible
    - expect: Buttons 'Favorites', 'Profile', 'Invoices', 'Messages' are visible
    - expect: The header menubar shows the account holder's name (e.g. 'Jane Doe') rather than 'Sign in'
  3. Confirm no request to the login form/page ever occurred during this test by checking the browser's navigation history contains no '/auth/login' entry
    - expect: The only navigation performed was directly to /account

#### 2.2. Test file B (separate spec file): independently reuses the same storageState to view Favorites

**File:** `tests/auth-reuse/favorites-view.spec.ts`

**Steps:**
  1. In a completely separate spec file from Test file A, configure the test to use the same storageState file
    - expect: No dependency or shared in-memory state exists between this file and 'account-overview.spec.ts' - each file only depends on the storageState file on disk
  2. Navigate directly to 'https://practicesoftwaretesting.com/account/favorites'
    - expect: Page title begins 'Favorites - Practice Software Testing - Toolshop'
    - expect: Heading 'Favorites' is visible
    - expect: A GET request to https://api.practicesoftwaretesting.com/favorites returns 200
    - expect: At least one favorited product card (e.g. a heading matching a product name such as 'Combination Pliers') is visible
  3. Click the button on a favorite item that removes it from favorites (the small icon button next to each favorite entry)
    - expect: The corresponding DELETE call to the favorites API succeeds
    - expect: The removed product card is no longer visible in the Favorites list

#### 2.3. Verify the header reflects the authenticated identity immediately after storageState is applied, with no flash of the logged-out 'Sign in' state

**File:** `tests/auth-reuse/no-login-flash.spec.ts`

**Steps:**
  1. Using the shared storageState, navigate to 'https://practicesoftwaretesting.com/'
    - expect: A GET request to https://api.practicesoftwaretesting.com/users/me returns 200 (never 401) on this load
    - expect: The header menubar shows the account name menuitem, not a 'Sign in' menuitem, once the page has settled
  2. Navigate to a second page, e.g. 'https://practicesoftwaretesting.com/product/' plus the id of the first product returned by GET /products, obtained at runtime via APIRequestContext rather than hardcoded
    - expect: The product detail page loads (heading level 1 with the product name is visible)
    - expect: The header still shows the authenticated account name, confirming the session persisted across navigation

#### 2.4. Negative: a storageState with a corrupted/expired auth-token value is treated as logged out

**File:** `tests/auth-reuse/corrupted-token.spec.ts`

**Steps:**
  1. Create a storageState object identical to the valid one, but replace the 'auth-token' localStorage value with an obviously invalid string (e.g. 'not-a-jwt')
    - expect: The storageState JSON is otherwise well-formed
  2. Launch a new context using this corrupted storageState and navigate to 'https://practicesoftwaretesting.com/account'
    - expect: A GET request to https://api.practicesoftwaretesting.com/users/me returns 401 Unauthorized
    - expect: The app redirects away from /account (or shows the public header state) and the header menubar shows 'Sign in' rather than an account name
    - expect: No unhandled exception/crash occurs in the app despite the malformed token

### 3. Playwright APIRequestContext for CRUD (seed data, verify, clean up)

**Seed:** `tests/seed.spec.ts`

#### 3.1. Register a new user via API, then verify login works through the UI with those credentials

**File:** `tests/api-crud/register-then-login.spec.ts`

**Steps:**
  1. Build a unique UserRequest payload (first_name, last_name, address {street, city, state, country, postal_code}, phone, dob '1990-01-01', password meeting the site's strength rules e.g. 'Str0ng!Passw0rd', and a unique email such as `qa.test.<timestamp>@example.com`)
  2. Send POST https://api.practicesoftwaretesting.com/users/register with that payload via APIRequestContext
    - expect: Response status is 201 Created
  3. Navigate to 'https://practicesoftwaretesting.com/auth/login' in the UI (no storageState applied for this test)
    - expect: Heading 'Login' is visible
  4. Enter the newly registered email into the 'Email address *' textbox and the chosen password into the 'Password *' textbox, then click the 'Login' button
    - expect: The page navigates to '/account'
    - expect: The header shows the new user's first and last name as the account menuitem
    - expect: GET https://api.practicesoftwaretesting.com/users/me returns 200 with the matching email
  5. Clean up: send a DELETE request for the created user (or, if no self-delete endpoint is available, record the id for manual/periodic cleanup) via APIRequestContext, using the Bearer token obtained from the login response
    - expect: Cleanup call completes without leaving orphaned data that would break repeat test runs (e.g. duplicate-email conflicts)

#### 3.2. Seed a cart via API before visiting checkout, verify the UI reflects it, then delete the cart

**File:** `tests/api-crud/seed-cart-cleanup.spec.ts`

**Steps:**
  1. Send GET https://api.practicesoftwaretesting.com/products via APIRequestContext to obtain a real, current product id and its price
    - expect: Response status is 200
    - expect: Response JSON includes a 'data' array with at least one product object containing an 'id' and 'price'
  2. Send POST https://api.practicesoftwaretesting.com/carts with an empty/init body via APIRequestContext
    - expect: Response status is 201 Created
    - expect: Response JSON includes a cart id (lowercase ULID-like string)
  3. Send POST https://api.practicesoftwaretesting.com/carts/{cartId} via APIRequestContext with body { product_id: <id from step 1>, quantity: 2 }
    - expect: Response status is 200 OK
  4. In the browser, set sessionStorage 'cart_id' to the seeded cart id (and 'cart_quantity' to '2') via page.evaluate, then navigate to 'https://practicesoftwaretesting.com/checkout'
    - expect: The Cart step (step 1 of the wizard) shows a table row for the seeded product with quantity 2 and the correct line-item total (price x 2)
    - expect: GET https://api.practicesoftwaretesting.com/carts/{cartId} was called and returned 200
  5. Clean up: send DELETE https://api.practicesoftwaretesting.com/carts/{cartId} via APIRequestContext
    - expect: Response status is 200 (or 204)
    - expect: A subsequent GET https://api.practicesoftwaretesting.com/carts/{cartId} either 404s or returns an empty cart, confirming the cart was actually removed

#### 3.3. Complete a guest checkout end-to-end and verify the invoice API response shape

**File:** `tests/api-crud/guest-checkout-invoice.spec.ts`

**Steps:**
  1. Using the UI, navigate to the home page, click the first product card, then click the 'Add to cart' button on its product detail page
    - expect: POST https://api.practicesoftwaretesting.com/carts returns 201 Created
    - expect: POST https://api.practicesoftwaretesting.com/carts/{cartId} returns 200 OK
    - expect: The header cart menuitem shows a badge count of '1'
  2. Click the 'cart' link in the header to open '/checkout', then click 'Proceed to checkout' on the Cart step
    - expect: The wizard advances to the 'Sign in' step (step 2) showing tabs 'Sign in' and 'Continue as Guest'
  3. Click the 'Continue as Guest' tab, fill 'Email address *', 'First name *', 'Last name *' with valid values, then click the 'Continue as Guest' button
    - expect: Text 'Continuing as guest: {first} {last} ({email})' is visible
    - expect: A 'Proceed to checkout' button becomes visible
  4. Click 'Proceed to checkout', then on the Billing Address step select a Country (e.g. 'Austria'), fill 'Postal code' and 'House number' only, and wait for the auto-filled Street/City/State values from GET https://api.practicesoftwaretesting.com/postcode-lookup
    - expect: GET .../postcode-lookup?country=..&postcode=..&house_number=.. returns 200
    - expect: Street, City, and State fields are auto-populated (non-empty) and left unmodified
    - expect: The 'Proceed to checkout' button becomes enabled
  5. Click 'Proceed to checkout', select 'Cash on Delivery' from the 'Payment Method' dropdown, and click 'Confirm'
    - expect: POST https://api.practicesoftwaretesting.com/payment/check returns 200
    - expect: Text 'Payment was successful' is visible
  6. Click 'Confirm' a second time to finalize the order
    - expect: POST https://api.practicesoftwaretesting.com/invoices/guest returns 200 or 201 (not 422)
    - expect: Response JSON includes an invoice id and total consistent with the cart contents
  7. Using APIRequestContext with the invoice id from step 6, send GET https://api.practicesoftwaretesting.com/invoices/{id}
    - expect: Response status is 200
    - expect: Response JSON's billing address fields match what was auto-filled in step 4 and the cart_id matches the cart created in step 1

#### 3.4. Negative: guest checkout invoice submission fails with 422 when billing city/country are inconsistent

**File:** `tests/api-crud/invoice-billing-mismatch-negative.spec.ts`

**Steps:**
  1. Repeat steps 1-3 of the guest checkout happy path (add a product to cart, reach the Billing Address step as a guest)
    - expect: Wizard is on the Billing Address step
  2. Select Country 'Austria', fill Postal code '1010' and House number '42', then, after the auto-fill from GET /postcode-lookup populates Street/City/State, manually overwrite the 'City' field with a city name inconsistent with the returned value (e.g. type 'Vienna' when the lookup returned a different city) and overwrite 'Street' similarly
    - expect: The 'Proceed to checkout' button is enabled once all required fields are non-empty, regardless of the mismatch
  3. Proceed to the Payment step, select 'Cash on Delivery', click 'Confirm' twice (first to run the payment check, second to submit the invoice)
    - expect: POST https://api.practicesoftwaretesting.com/invoices/guest returns 422 Unprocessable Content
    - expect: Response JSON's 'message' field states the billing_country does not match the entered address / the city does not belong to the selected country, and 'errors.billing_country' is a non-empty array
    - expect: The UI does not show an order confirmation and remains on/returns to the Payment or Billing Address step

#### 3.5. Negative: registering with an already-used email returns 409 Conflict

**File:** `tests/api-crud/register-duplicate-email-negative.spec.ts`

**Steps:**
  1. Send POST https://api.practicesoftwaretesting.com/users/register via APIRequestContext with a fresh unique email and a valid full UserRequest payload
    - expect: Response status is 201 Created
  2. Immediately send a second POST https://api.practicesoftwaretesting.com/users/register with the identical email but otherwise valid payload
    - expect: Response status is 409 Conflict
    - expect: Response JSON contains a message indicating the email is already registered/taken
  3. Clean up any test data created in step 1 as feasible
    - expect: No leftover duplicate-email account blocks future test runs

#### 3.6. Submit the contact form and verify the underlying /messages API call and response shape

**File:** `tests/api-crud/contact-form-message.spec.ts`

**Steps:**
  1. Navigate to 'https://practicesoftwaretesting.com/contact'
    - expect: Heading 'Contact' is visible
  2. Fill 'First name', 'Last name', 'Email address' textboxes, select 'Customer service' from the 'Subject' dropdown, and fill the 'Message *' textbox with a message of at least 20 characters
    - expect: All fields show the entered values
  3. Click the 'Send' button
    - expect: POST https://api.practicesoftwaretesting.com/messages returns 200 OK
    - expect: An alert with text 'Thanks for your message! We will contact you shortly.' is visible

### 4. Network Interception / Mocking (page.route)

**Seed:** `tests/seed.spec.ts`

#### 4.1. Mock GET /products to return an empty list and verify the home page's empty state

**File:** `tests/mocking/products-empty-state.spec.ts`

**Steps:**
  1. Before navigating, register a page.route interceptor for the pattern '**/products*' (matching https://api.practicesoftwaretesting.com/products and its query string) that fulfills with status 200 and JSON body { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } (or the shape observed from the real endpoint with an empty data array)
  2. Navigate to 'https://practicesoftwaretesting.com/'
    - expect: No real request reaches api.practicesoftwaretesting.com/products (the intercepted route is used instead)
    - expect: The product grid area shows no product cards
    - expect: An appropriate empty/'no products found' indication is shown instead of product cards (or the grid area is empty with no error thrown)
    - expect: The pagination control does not show more than 1 page

#### 4.2. Mock GET /products to return a 500 error and verify an error state is shown

**File:** `tests/mocking/products-server-error.spec.ts`

**Steps:**
  1. Register a page.route interceptor for '**/products*' that fulfills with status 500 and a JSON body such as { message: 'Internal Server Error' }
  2. Navigate to 'https://practicesoftwaretesting.com/'
    - expect: The mocked 500 response is received by the page (confirm via the route handler or via page console error matching 'Failed to load resource ... 500')
    - expect: The product grid does not display any product cards (since no real data was returned)
    - expect: The rest of the page (header, sidebar filters, footer) still renders without crashing

#### 4.3. Mock GET /products/search to control search results and verify the result-count message

**File:** `tests/mocking/search-mocked-results.spec.ts`

**Steps:**
  1. Register a page.route interceptor for '**/products/search*' that fulfills with status 200 and a JSON body containing exactly 2 fabricated product objects (each with id, name, price, in_stock)
  2. Navigate to the home page, type 'Pliers' into the 'Search' textbox, and click the 'Search' button
    - expect: Heading 'Searched for: Pliers' is visible
    - expect: Paragraph text reads '2 products found for 'Pliers'' (matching the mocked count, not the real 4)
    - expect: The two fabricated product names are visible in the results grid

#### 4.4. Mock POST /users/login with a delayed response and verify a loading/disabled state on the Login button

**File:** `tests/mocking/login-slow-loading-state.spec.ts`

**Steps:**
  1. Register a page.route interceptor for '**/users/login' that waits 3 seconds before fulfilling with status 200 and a valid-shaped body { access_token: '<fake-jwt>', token_type: 'Bearer', expires_in: 300 }
  2. Navigate to 'https://practicesoftwaretesting.com/auth/login', fill 'Email address *' and 'Password *' with the demo credentials, and click 'Login'
    - expect: Immediately after clicking, the 'Login' button enters a busy/disabled visual state (or a spinner is shown) while the mocked request is pending
    - expect: Once the delayed mock response resolves, the app proceeds to '/account' as if a real login succeeded

#### 4.5. Mock GET /carts/{cartId} to return a malformed/empty cart and verify checkout does not crash

**File:** `tests/mocking/checkout-empty-cart-mock.spec.ts`

**Steps:**
  1. Register a page.route interceptor for the pattern '**/carts/*' (GET only) that fulfills with status 200 and JSON body { id: 'mock-cart-id', cart_items: [] }
  2. Set sessionStorage 'cart_id' to 'mock-cart-id' via page.evaluate and navigate to 'https://practicesoftwaretesting.com/checkout'
    - expect: No unhandled JavaScript exception occurs (in particular, no repeat of the observed 'Cannot read properties of undefined (reading `cart_items`)' console error)
    - expect: The Cart step shows an empty cart state (no line items, or a $0.00/empty total) rather than a blank crashed page
    - expect: The 'Proceed to checkout' / 'Continue Shopping' controls remain visible and usable

#### 4.6. Mock GET /favorites to return 401 while the UI expects an authenticated user, verify graceful handling

**File:** `tests/mocking/favorites-unauthorized-mock.spec.ts`

**Steps:**
  1. Using the authenticated storageState from Suite 1, register a page.route interceptor for '**/favorites' that fulfills with status 401 and JSON body { message: 'Unauthorized' }, overriding the real (otherwise-200) response
  2. Navigate to 'https://practicesoftwaretesting.com/account/favorites'
    - expect: The mocked 401 is what the page actually receives for the favorites request
    - expect: The page does not display any favorite product cards
    - expect: The app shows a reasonable fallback (empty list, error message, or redirect) rather than an unhandled crash, even though the user's stored token is otherwise valid

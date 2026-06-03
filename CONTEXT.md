# next-server-devtools

next-server-devtools is a development-time network inspection tool for requests that an application chooses to observe. Its language separates the observed request itself from where it was captured.

## Language

**Observed Request**:
An HTTP request/response lifecycle captured by next-server-devtools and shown in the Network Panel. An Observed Request has one **Capture Source**.
_Avoid_: raw request, network log item

**Capture Source**:
The runtime side where an **Observed Request** was captured. The canonical sources are **Server** and **Client**.
_Avoid_: origin, environment

**Server Request**:
An **Observed Request** captured while application code runs on the server side of a Next.js app.
_Avoid_: backend request, API call

**Client Request**:
An **Observed Request** captured while application code runs in the browser.
_Avoid_: frontend request, browser log

**Network Entry**:
The panel row and detail view representing one **Observed Request**.
_Avoid_: entry, row, event

**Observation Session**:
The current browser-visible period of observation in the **Network Panel**. It starts after a page reload or explicit clear/restart action, and older **Network Entries** are not shown.
_Avoid_: log lifetime, storage window

**Network Panel**:
The browser-visible interface that lists **Network Entries** and shows request/response details.
_Avoid_: logger UI, debug page

**Devtools Dock**:
The embedded, reload-persistent drawer that hosts the **Network Panel** inside an application page.
_Avoid_: drawer, widget

**Embedded UI**:
The package-owned browser UI rendered inside the consuming application without depending on the application's component library or styling system.
_Avoid_: app UI, host UI

**Redaction Policy**:
The rule set that replaces **Sensitive Values** before an **Observed Request** is exposed in the **Network Panel**. Redaction is part of observation, not a separate display mode.
_Avoid_: masking, hiding

**Sensitive Value**:
A request or response value that could expose credentials, sessions, tokens, or other secrets if shown in the browser.
_Avoid_: private value, secure field

## Example Dialogue

Developer: "This Server Request is missing from the Network Panel."

Maintainer: "Was it an Observed Request, or was the app making the HTTP call through an uncaptured path?"

Developer: "It was observed, but I want to compare it with a Client Request from the same user action."

Maintainer: "Use the Capture Source filter to show Server and Client together, then inspect the two Network Entries."

Developer: "Why did the old Network Entries disappear after reload?"

Maintainer: "A reload starts a new Observation Session, so only newly observed requests are shown."

Developer: "Can I copy the original Authorization header from this Network Entry?"

Maintainer: "No. The Redaction Policy replaces Sensitive Values before they reach the Network Panel."

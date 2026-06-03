# Register fetch from the devtools component by default

MVP users should be able to install next-server-devtools by adding `<NextServerDevtools />` to their root layout and creating the documented route handlers. We will let that server component register the development-only `globalThis.fetch` wrapper, while keeping `instrumentation.ts` as an optional path for users who need earlier or broader server capture. This favors a lighter default setup over perfect coverage for route handlers and other server execution paths that do not render the application layout.

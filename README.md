# Phoenix

Phoenix is a Pomodoro focus app packaged as an erxes plugin. Its React UI
provides a focus timer, breaks, task list, focus statistics, ambient sound
controls, and a customizable Pallas’s cat companion with a small marketplace.
The UI is a Module Federation remote; the Node.js API follows the erxes plugin
contract.

## Project layout

- `ui/` — React 18, TypeScript, Tailwind CSS 4, and Rspack UI remote.
- `api/` — Node.js 22, TypeScript, GraphQL API plugin.
- `erxes.json` — plugin identity, routes, ports, and framework configuration.
- `docs/erxes-integration.md` — host requirements, API trust boundary, and
  production deployment instructions.

## Requirements

- Node.js 22
- pnpm 12 (the repository declares `pnpm@12.15.0`)
- Redis for plugin registration and gateway integration
- MongoDB for the platform stack
- A compatible erxes host for loading and testing the federated UI

## Local development

Install dependencies from the project root:

```sh
pnpm install
```

Create a local environment file and set the values required by your setup:

```sh
cp .env.example .env
```

At minimum, configure Redis. The platform API also needs `MONGO_URL`. Set
`UI_ENTRY_URL` to the browser-accessible UI remote URL; for local development,
the example uses `http://localhost:3099/remoteEntry.js`. Keep the API private
to the trusted gateway in deployed environments.

Start the API and UI in separate terminals:

```sh
pnpm run dev:api
pnpm run dev:ui
```

The manifest defaults to API port `3399` and UI port `3099`. `PORT` can
override the API port. The host must have the Phoenix plugin enabled to load
the UI through erxes.

## Common commands

Run these from the project root:

| Command | Purpose |
| --- | --- |
| `pnpm run dev:api` | Start the API in watch mode. |
| `pnpm run dev:ui` | Generate GraphQL types and start the UI remote. |
| `pnpm run codegen` | Print the API schema and generate typed UI GraphQL documents. |
| `pnpm run check` | Generate GraphQL types and type-check the API and UI. |
| `pnpm run lint` | Lint the project with Oxlint. |
| `pnpm run build` | Generate GraphQL types and build the API and UI. |
| `pnpm run fmt` | Format supported project files with Oxfmt. |

## Using Phoenix

Open the Phoenix app at `/phoenix` in an enabled erxes host. The sidebar
contains the app navigation and light/dark theme switcher. The theme choice is
saved in browser local storage.

The focus dashboard includes:

- Focus, short-break, and long-break timer modes.
- A configurable timer duration and automatic phase transitions.
- A task list for the current focus session.
- Focus-session count and break-cycle information.
- Ambient sound selection and companion sleep mode controls.
- A Pallas’s cat companion with cosmetic unlocks bought using earned coins.

Timer, profile, task, and companion collection state are stored in the current
browser's local storage. Clearing site data or using a different browser
removes or does not share that state.

## Theme and UI conventions

The UI uses a blue palette based on `#E5F0FF`, `#CCE0FF`, `#99C2FF`,
`#66A3FF`, and `#3385FF`. Light mode uses `#002966` for readable text. Use
the sidebar toggle to switch between light and dark appearances.

Because the UI runs inside core-ui, use the `phoenix:` Tailwind prefix for
remote utility classes. Avoid unprefixed utilities that could affect the host
or another plugin. See `ui/src/styles.css` for the palette and theme tokens.

## erxes integration and deployment

Enable `phoenix` in `ENABLED_PLUGINS` on both gateway and core-api. Configure
Redis to use the same service/database as erxes. For production, build the UI
and publish the complete `ui/dist` directory to a static host, then set the
API's `UI_ENTRY_URL` to the browser-accessible HTTPS URL for
`remoteEntry.js`.

Follow [`docs/erxes-integration.md`](./docs/erxes-integration.md) for the
complete plugin naming rules, host compatibility details, permissions,
trusted gateway boundary, and deployment steps. In particular, the API must
not be exposed directly to untrusted clients: forwarded identity and tenant
headers are trusted gateway assertions.

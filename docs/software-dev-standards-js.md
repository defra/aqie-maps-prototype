# GDS Frontend Development Rules

## AI Assistant Behavior
As an AI assistant creating a GDS compliant frontend you should:
- **Prioritize accessibility** and government standards in all suggestions
- **Use semantic search** to understand existing patterns before suggesting new code
- **Read existing files** to understand the current implementation before making changes
- **Follow the established folder structure** and naming conventions
- **Test suggestions** against GOV.UK Design System guidelines
- **Explain the reasoning** behind accessibility and content design choices
- **Suggest improvements** that align with user-centered design principles

## Project Overview
This project is an interactive prototype built on the **GOV.UK Prototype Kit**, used to explore and test air quality user journeys for the AQIE (Air Quality Information for England) service. The prototype:
- **Is not production code** — it exists solely to test ideas with users and stakeholders
- **Department**: Department for Environment, Food and Rural Affairs (Defra)
- Consumes data from the `aqie-back-end` service (forecasts, measurements, monitoring station info)
- Runs on the Core Delivery Platform (CDP) when deployed to a CDP environment


## Technical Framework
- **Runtime**: Node.js `>= v22`
- **Server-side**: Express.js, provided and managed by the GOV.UK Prototype Kit — do **not** create or configure a custom server
- **Module system**: CommonJS (`require` / `module.exports`) — the Prototype Kit does **not** support ES modules
- **Templating**: Nunjucks (`.html` file extension by Prototype Kit convention)
- **UI Components**: GOV.UK Design System via `govuk-frontend` and `@govuk-prototype-kit/common-templates`
- **Routing API**: `govukPrototypeKit.requests.setupRouter()` from `govuk-prototype-kit`
- **Filters API**: `govukPrototypeKit.views.addFilter` from `govuk-prototype-kit`

## Folder Structure
The GOV.UK Prototype Kit mandates the `app/` directory layout. Do **not** use `src/` or any other top-level directory for application code.

```
[root]/
├── app/
│   ├── routes.js          # All custom Express route handlers
│   ├── filters.js         # Custom Nunjucks filters (via govukPrototypeKit.views.addFilter)
│   ├── config.json        # Prototype Kit configuration (e.g. rebrand flag)
│   ├── api/               # Modules that call external services (e.g. aqie-back-end)
│   ├── assets/            # Static assets (images, client-side JS, SCSS)
│   │   ├── javascripts/
│   │   └── sass/
│   ├── data/              # Seed / fixture JSON consumed by templates
│   └── views/             # Nunjucks templates (.html extension)
│       └── layouts/       # Custom layout overrides (extend govuk-prototype-kit layouts)
├── .env                   # Local environment variables (not committed)
├── .env.template          # Template for .env
└── package.json
```

## Code Standards

### Templates
- Template files live in `app/views/` and use the **`.html`** extension (Prototype Kit convention)
- Extend the kit's built-in layout rather than a custom one:
  ```nunjucks
  {% extends "govuk-prototype-kit/layouts/govuk-branded.njk" %}
  ```
- To customise the layout, create `app/views/layouts/main.html` and extend the kit layout there; then extend `layouts/main.html` from page templates
- Use Nunjucks macros from GOV.UK Design System — macro import paths use the `govuk/` prefix provided by `govuk-frontend`:
  ```nunjucks
  {% from "govuk/components/input/macro.njk" import govukInput %}
  {% from "govuk/components/button/macro.njk" import govukButton %}
  ```
- Session data is automatically available in templates as `{{ data['field-name'] }}`

### SCSS/Styling Standards

**Core Principle:** Maximize style reuse. Minimize new styles.

**Class Naming:**
- Custom classes: prefix with `app-`

**Styling Priority (Follow in Order):**
1. **Reuse existing app styles** - Always check first. Prefer consistency over perfect design match.
2. **Use GOV.UK Design System** - Search `node_modules/govuk-frontend` for applicable styles.
3. **Never create new styles** - ONLY as last resort. Requires user approval. Must use `app-` prefix.

**Rules:**
- Never rewrite or duplicate existing styles
- Add new styles only when absolutely necessary
- Seek explicit approval before creating any new `app-` classes
- Always extract and reuse hardcoded variables (e.g. colours & dimensions)

### JavaScript Standards

**Module system — CommonJS only:**  
The GOV.UK Prototype Kit runs in CommonJS mode. Always use `require`/`module.exports`; **never** use `import`/`export`.

```js
// correct
const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
module.exports = router

// wrong — will break the prototype
import govukPrototypeKit from 'govuk-prototype-kit'
```

**Routing — `app/routes.js`:**
- All routes belong in `app/routes.js` (or files required from it)
- Obtain the router from the kit, not from Express directly:
  ```js
  const govukPrototypeKit = require('govuk-prototype-kit')
  const router = govukPrototypeKit.requests.setupRouter()
  ```
- Render templates with `res.render('my-page.html', { ...data })`

**Filters — `app/filters.js`:**
- Register custom Nunjucks filters using the kit's API:
  ```js
  const { views } = require('govuk-prototype-kit')
  views.addFilter('myFilter', (value) => { ... })
  ```

**Code style:**
- 2 spaces indentation, no tabs
- Single quotes for strings, template literals for interpolation
- `const` by default, `let` when reassignment is needed — no `var`
- Parentheses required around arrow function parameters
- No semicolons at end of statements

**Testing:**  
The GOV.UK Prototype Kit is a prototyping tool, not a production application. Automated testing is generally not required. If logic is complex enough to warrant testing, extract it into a standalone module and test that in isolation.

**Dependency Management:**
- Pin dependencies to exact versions in `package.json`
- No range specifiers (`^`, `~`)

### Formatting Standards
- Nunjucks templates: 2 spaces indentation, no tabs
- SCSS: 2 spaces indentation, no tabs

### Code Organization
- Define and reuse Nunjucks filters (e.g., `toMonth`, `toMoney`)
- Separate data from presentation

### Validation & Accessibility
- Return validation errors with `govukErrorSummary`
- Add per-field error items
- Meet WCAG 2.2 AA standards
- Follow Home Office accessibility poster guidance:
  - Appropriate colour contrast
  - Visible focus styles
  - Error feedback announced via `aria-live`
  - All inputs properly labelled

### Content Design
- Follow GOV.UK style guide with adaptations for internal users:
  - Sentence case
  - ISO date format (e.g., "24 April 2025")
  - Clear, professional language (can use Defra-specific terminology)
  - No ampersands
  - Active voice
- Front-load key information
- One idea per sentence
- Address users directly using second person ("you")
- For internal services, you can:
  - Use technical terms and acronyms familiar to Defra staff
  - Be more concise where appropriate
  - Focus on task completion rather than extensive explanation

### UI Components
Use GOV.UK Design System components for:
- Form elements (inputs, checkboxes, radio buttons)
- Error messages and validation feedback
- Success messages and confirmation screens
- Navigation elements including phase banners
- Information display (tables, lists, alerts)
- Progress indicators and loading states

## Development Workflow
When working with this codebase, run the prototype via Docker:

**Build the development image:**
```bash
docker build --target development --no-cache --tag aqie-maps-prototype:development .
```

**Run the container:**
```bash
docker run \
  --add-host=host.docker.internal:host-gateway \
  -e PORT=3000 \
  -e AQIE_BACK_END_URL=http://host.docker.internal:3001 \
  -p 3000:3000 \
  aqie-maps-prototype:development
```

> On macOS `--add-host` is not required (Docker Desktop handles host routing automatically), but it is needed on Linux so the container can reach `aqie-back-end` running on the host.

The prototype will be available at http://localhost:3000. The development image mounts source files and the kit reloads on changes.

**Other guidance:**
- **Search existing patterns** in `app/views/` and `app/routes.js` before creating new pages
- **Reuse established components** and layouts where possible
- **Session data**: The kit persists form inputs in session automatically; read values via `req.session.data['field-name']` in routes or `{{ data['field-name'] }}` in templates
- **Bypassing session**: Pass data explicitly via `res.render('page.html', { key: value })` when the page needs computed or API-fetched data
- **Test accessibility** with screen readers and keyboard navigation
- **Validate against** GOV.UK Design System documentation at https://design-system.service.gov.uk/

## File Creation Guidelines
When creating:
- **New page/view**: Add a `.html` template in `app/views/` (e.g. `app/views/forecast.html`) and a matching `router.get` / `router.post` in `app/routes.js`
- **New layout**: Create `app/views/layouts/[layout-name].html` extending the kit's base layout:
  ```nunjucks
  {% extends "govuk-prototype-kit/layouts/govuk-branded.njk" %}
  ```
- **New partial/macro**: Create `app/views/[component-name].html` and `{% include %}` or `{% from ... import %}` it in page templates
- **New API module**: Create `app/api/[service-name].js` using CommonJS `require`/`module.exports`; require it in `app/routes.js`
- **New filter**: Add a `views.addFilter(...)` call in `app/filters.js`
- **Fixture data**: Add JSON files to `app/data/`; the kit makes them available in templates automatically
- **Static assets**: Place client-side JS in `app/assets/javascripts/` and SCSS in `app/assets/sass/`
- **Do not** create a `src/` directory, a custom server file, or Hapi plugins — the Prototype Kit manages all of this

## Quality Checklist
Before suggesting any code changes, ensure:
- [ ] Accessibility requirements are met
- [ ] GOV.UK Design System components are used correctly
- [ ] Content follows government style guide
- [ ] Error handling and validation is implemented
- [ ] Code follows established patterns in the project
- [ ] Existing styles have been checked for reuse before creating new ones
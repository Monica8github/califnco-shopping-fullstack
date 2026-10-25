# Separate package verification

- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund`: PASS
- `npm run check`: PASS
- `npm test`: PASS
- `npm run check:runtime`: PASS
- `npm run build:deployment`: PASS

Checks used locally available dependencies; no fresh network installation or live provider integration was tested.

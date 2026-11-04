# Changelog

## 26.11.1 (2026-11-04)

### Features

- **operations:** poll the page and describe image pulls (e961aa3)
- **operations:** show the current stage and survive both progress shapes (d2c6e2b)
- **operations:** live progress in the operations pane and page (7b22b83)
- **wizard:** move pull control above the list; always show the image hint (9fbc222)
- **wizard:** open in the large Window shell (79bd864)
- **dialog:** size tiers; create-instance wizard uses the xl window (1d82843)
- **ui:** SegmentedControl component; type under name in wizard; gallery entry (ec49c71)
- **wizard:** compact segmented control for instance type (2c76c2f)
- **forms:** placeholders across dialogs; simpler type field; gallery error demo (51aca48)
- **forms:** animate field error state and attached chip (221b406)
- **forms:** connected error chips; name message under the field (396e35f)
- **config:** render enumerated values as a combobox; add gallery demo (433ac12)
- **config:** drive value suggestions from the Incus API (92a5818)
- **config:** type- and content-aware value autocomplete (be24eb3)

### Bug fixes

- **create:** wait for the operation with live progress instead of closing early (8467289)
- **window:** viewport-aware body height; wizard fits without scrolling (9dad9b8)
- **wizard:** fit the image step without scrolling (68121d1)
- **wizard:** keep the chosen image across steps; show it in the picker (19586c4)
- **image-picker:** flatter rows, taller list, less nesting (73ba589)
- **forms:** keep field border, borderless inset error chip (7aacb48)
- **color-picker:** theme-aware selection ring for light mode (ca6603b)

## 26.11.0 (2026-11-04)

### Bug fixes

- **instances:** don't show loopback as an instance's IP address (4d7d896)

## 26.10.0 (2026-10-06)

### Features

- **shell:** show the app version in the sidebar footer (2f6385e)
- **shell:** wire up command palette, System group, connection banner and drawer (f074ea5)
- **pages:** stepped editors, bulk actions, backups, identities and zones (134c1f4)
- **dialogs:** add stepped dialogs and move create, copy, move and pull flows onto them (50d14c6)
- **ui:** improve keyboard access, theming and persistence in shared components (701d26d)
- add shared helpers and state for persistence, focus, palette and theme (e88f4c2)
- **api:** add auth, peers, load balancers, backups and project state (532d97b)

### Bug fixes

- **dev:** load the Incus client certificate lazily in the dev proxy (c62f3d4)

# Attribution and model scope

Formula Atlas is inspired by [Human Atlas](https://github.com/ashemag/human-atlas) by ashemag. Its component selection, system layers, isolation, and assembled-to-inventory interaction informed this project. `src/pointer-tap.ts` is reused from Human Atlas under the MIT license. The copyright notice and permission terms are included in `LICENSE`.

The Formula car geometry, catalogue, layout, and other application code were created for this project and are released under the MIT license. No BodyParts3D data or third-party car meshes are included. No team liveries, sponsors, or official logos are used.

## Model scope

FA–01 is a simplified, generic educational representation of the 2022–2025 ground-effect Formula car generation. It is not a team-specific CAD model, a dimensionally certified replica, or a complete engineering bill of materials. Each selectable component is an assembly and can include several meshes. Fasteners, wiring, hydraulic circuits, and many small internal parts are omitted. Cooling and internal power-unit packaging are schematic. Both axles use an illustrative pushrod layout; team configurations vary.

The MGU-H, 120 kW MGU-K, rear-wing DRS, and ground-effect tunnel descriptions belong to that era. This is not a representation of the revised 2026 rules.

## Technical references

- [FIA 2025 Formula 1 technical regulations, issue 1, 11 December 2024](https://www.fia.com/sites/default/files/fia_2025_formula_1_technical_regulations_-_issue_01_-_2024-12-11_1.pdf): bodywork, power unit, fuel system, transmission, suspension, steering, brakes, wheels, survival cell, and safety structures.
- [Formula 1: 10 things you need to know about the all-new 2022 F1 car](https://www.formula1.com/en/latest/article/10-things-you-need-to-know-about-the-all-new-2022-f1-car.4OLg8DrXyzHzdoGrbqp6ye): the ground-effect generation, 18-inch wheels, winglets, wing concepts, and hybrid engine architecture.

Descriptions are original educational summaries, not quotations from the regulations. Links are included in the inspector and model-notes dialog. The selected FIA issue establishes historical context, not a claim about current regulations.

## Dependencies

React, Three.js, Lucide, Vite, and the other packages retain their own licenses. Inter and Barlow Condensed are distributed through Fontsource under the SIL Open Font License. Font files are bundled locally, with no Google Fonts request at runtime.

This project is independent and is not affiliated with Formula 1, the FIA, or any team. Names and marks belong to their respective owners.

# Responsive Contract

Read this reference only for `responsive_required` work. It converts multiple Figma frames into implementable rules without inventing a mobile design.

## Required Inputs

- Target desktop and SP/mobile frame references, their exact viewport widths, and relevant states.
- Components that change visibility, order, columns, sizing, overflow, content priority, or interaction between those frames.
- Explicit approval for any breakpoint or intermediate-width interpolation not shown in design.

If a mobile frame is absent and the missing behavior affects information hierarchy, navigation, table treatment, copy, or action placement, record a blocker instead of guessing.

## Component Matrix

| Component | Desktop | SP/mobile | Intermediate rule | Overflow / long content | Evidence / confidence |
|---|---|---|---|---|---|

## Validation Matrix

- Screenshot every supplied Figma viewport/state.
- Check one width immediately below and immediately above each implemented breakpoint.
- Check long labels, long localized copy, empty data, full tables, missing images, keyboard focus, menus/modals, and horizontal-scroll behavior when relevant.
- Report exact viewports, observed deviations, and whether each is a customer-approved variation.

`No layout break` means these declared checks passed. It is not an absolute claim about every possible device or unknown content length.

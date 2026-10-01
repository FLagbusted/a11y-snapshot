// Plain-English explanations for the axe rules that most often show up on Shopify storefronts.
// Anything not listed falls back to axe's own help text.
module.exports = {
  'image-alt': {
    who: 'Screen-reader users',
    what: 'Images have no text alternative, so product photos and banners are announced as "image" or a file name.',
    fix: 'Add alt text in Shopify admin (Products > media > "Add alt text") and to theme images; use alt="" for purely decorative images.',
  },
  'link-name': {
    who: 'Screen-reader and voice-control users',
    what: 'Some links have no readable name (often icon-only links such as social icons, cart or logo links).',
    fix: 'Give icon links a visually hidden label or aria-label, e.g. "Instagram", "Cart (2 items)".',
  },
  'button-name': {
    who: 'Screen-reader and voice-control users',
    what: 'Some buttons have no readable name (quantity +/−, close, slider arrows, menu toggles).',
    fix: 'Add aria-label or visually hidden text to icon-only buttons in the theme snippets.',
  },
  'color-contrast': {
    who: 'Low-vision and older shoppers, anyone on a phone in sunlight',
    what: 'Text does not have enough contrast against its background (WCAG AA needs 4.5:1 for normal text).',
    fix: 'Adjust theme colour settings or the specific CSS for the flagged text (prices, badges, footer links are common).',
  },
  'label': {
    who: 'Screen-reader users',
    what: 'Form fields (newsletter, search, quantity) have no programmatic label, so users hear "edit text" with no purpose.',
    fix: 'Associate a <label> with each field or add aria-label; placeholder text alone is not a label.',
  },
  'select-name': {
    who: 'Screen-reader users',
    what: 'Drop-downs (variant or sort selectors) have no label.',
    fix: 'Add a <label for> or aria-label to each <select>.',
  },
  'html-has-lang': {
    who: 'Screen-reader users',
    what: 'The page does not declare its language, so it may be read with the wrong pronunciation.',
    fix: 'Set lang on the <html> element in theme.liquid.',
  },
  'document-title': {
    who: 'Screen-reader users and anyone with many tabs open',
    what: 'The page has no title.',
    fix: 'Ensure theme.liquid outputs a <title>.',
  },
  'meta-viewport': {
    who: 'Low-vision mobile shoppers',
    what: 'Pinch-zoom is disabled on mobile.',
    fix: 'Remove maximum-scale=1 / user-scalable=no from the viewport meta tag.',
  },
  'aria-allowed-attr': { who: 'Screen-reader users', what: 'ARIA attributes are used on elements that do not support them, which can confuse assistive technology.', fix: 'Remove or correct the invalid ARIA attributes in the flagged components.' },
  'aria-hidden-focus': { who: 'Keyboard and screen-reader users', what: 'Focusable elements sit inside regions hidden from assistive technology (common in sliders and drawers), so keyboard users land on "invisible" controls.', fix: 'Add tabindex="-1" / inert to hidden slides and closed drawers, or remove aria-hidden.' },
  'aria-required-children': { who: 'Screen-reader users', what: 'A component declares an ARIA role but is missing the child roles it needs (e.g. a list without items, tabs without tab).', fix: 'Fix the component markup so required child roles exist.' },
  'list': { who: 'Screen-reader users', what: 'Lists contain elements other than list items, so item counts are announced wrongly.', fix: 'Only place <li> elements directly inside <ul>/<ol>.' },
  'listitem': { who: 'Screen-reader users', what: 'List items appear outside a list.', fix: 'Wrap <li> elements in <ul> or <ol>.' },
  'nested-interactive': { who: 'Keyboard and screen-reader users', what: 'Interactive controls are nested inside other controls (e.g. a button inside a link), which behaves unpredictably.', fix: 'Separate the nested controls.' },
  'frame-title': { who: 'Screen-reader users', what: 'Embedded frames (chat widgets, video, reviews) have no title.', fix: 'Add a title attribute describing each iframe.' },
  'duplicate-id-aria': { who: 'Screen-reader users', what: 'Duplicate IDs break the links between labels and fields.', fix: 'Make referenced IDs unique (often repeated product-card snippets).' },
  'svg-img-alt': { who: 'Screen-reader users', what: 'SVG images with role="img" have no text alternative.', fix: 'Add <title> or aria-label to meaningful SVGs; aria-hidden="true" to decorative ones.' },
  'role-img-alt': { who: 'Screen-reader users', what: 'Elements marked as images have no text alternative.', fix: 'Add aria-label or make them decorative.' },
  'input-image-alt': { who: 'Screen-reader users', what: 'Image buttons have no text alternative.', fix: 'Add alt text to <input type="image">.' },
  'link-in-text-block': { who: 'Colour-blind shoppers', what: 'Links inside text are distinguished by colour only.', fix: 'Underline in-text links or ensure 3:1 contrast plus a non-colour cue.' },
  'target-size': { who: 'Shoppers with motor impairments, most mobile users', what: 'Tap targets are smaller than 24×24 px and too close together (WCAG 2.2).', fix: 'Increase padding on small icons and links.' },
  'autocomplete-valid': { who: 'Shoppers with cognitive or motor impairments', what: 'Form fields use invalid autocomplete values.', fix: 'Use valid autocomplete tokens (email, given-name, postal-code...).' },
  'scrollable-region-focusable': { who: 'Keyboard users', what: 'Scrollable areas cannot be reached with the keyboard.', fix: 'Add tabindex="0" to scrollable containers or make their content focusable.' },
};

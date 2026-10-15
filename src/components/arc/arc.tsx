'use client';

/**
 * ARC UI (arcui.dev) React wrappers for Flight Deck.
 *
 * Each wrapper module imports its Lit element, which registers the custom
 * element as a side effect. Importing from this 'use client' module keeps that
 * registration in the client bundle; on the server @lit/react renders the bare
 * tag and the element upgrades after hydration.
 *
 * Tokens: ARC's global base.css is NOT imported (it redefines Tailwind theme
 * variables). `arc-tokens.css` scopes the same tokens to ARC hosts instead.
 * When you use a component not listed here, add it below and add its tag to
 * the selector lists in arc-tokens.css.
 */
import './arc-tokens.css';

export { Accordion } from '@arclux/arc-ui-react/Accordion';
export { AccordionItem } from '@arclux/arc-ui-react/AccordionItem';
export { AnimatedNumber } from '@arclux/arc-ui-react/AnimatedNumber';
export { CtaBanner } from '@arclux/arc-ui-react/CtaBanner';
export { FeatureCard } from '@arclux/arc-ui-react/FeatureCard';
export { GradientText } from '@arclux/arc-ui-react/GradientText';
export { Marquee } from '@arclux/arc-ui-react/Marquee';

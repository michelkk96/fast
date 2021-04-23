import { css } from "@microsoft/fast-element";
import {
    display,
    focusVisible,
    forcedColorsStylesheetBehavior,
} from "@microsoft/fast-foundation";
import { SystemColors } from "@microsoft/fast-web-utilities";
import {
    cornerRadius,
    designUnit,
    focusOutlineWidth,
    outlineWidth,
} from "../design-tokens";
import {
    neutralFocusBehavior,
    neutralLayerFloatingBehavior,
    neutralOutlineFocusBehavior,
    neutralOutlineRestBehavior,
} from "../styles/recipes";

export const listboxStyles = (context, definition) =>
    css`
        ${display("inline-flex")} :host {
            background: ${neutralLayerFloatingBehavior.var};
            border: calc(${outlineWidth} * 1px) solid ${neutralOutlineRestBehavior.var};
            border-radius: calc(${cornerRadius} * 1px);
            box-sizing: border-box;
            flex-direction: column;
            padding: calc(${designUnit} * 1px) 0;
        }

        :host(:focus-within:not([disabled])) {
            border-color: ${neutralFocusBehavior.var};
            box-shadow: 0 0 0 1px ${neutralFocusBehavior.var} inset;
        }
    `.withBehaviors(
        forcedColorsStylesheetBehavior(
            css`
            :host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]) {
                background: ${SystemColors.Highlight};
                border-color: ${SystemColors.ButtonText};
                box-shadow: 0 0 0 calc(${focusOutlineWidth} * 1px) inset ${SystemColors.HighlightText};
                color: ${SystemColors.HighlightText};
                fill: currentcolor;
            }

            :host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]) {
                background: ${SystemColors.Highlight};
                border-color: ${SystemColors.ButtonText};
                box-shadow: 0 0 0 calc(${focusOutlineWidth} * 1px) inset ${SystemColors.HighlightText};
                color: ${SystemColors.HighlightText};
                fill: currentcolor;
            }
        `
        ),
        neutralLayerFloatingBehavior,
        neutralOutlineRestBehavior,
        neutralOutlineFocusBehavior
    );

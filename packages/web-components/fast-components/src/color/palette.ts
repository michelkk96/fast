import {
    clamp,
    ColorHSL,
    ColorLAB,
    ColorRGBA64,
    hslToRGB,
    interpolateRGB,
    labToRGB,
    rgbToHSL,
    rgbToLAB,
    rgbToRelativeLuminance,
} from "@microsoft/fast-colors";
import { isSwatchRGB, Swatch, SwatchRGB } from "./swatch";
import { binarySearch } from "./utilities/binary-search";
import { directionByIsDark } from "./utilities/direction-by-is-dark";
import { contrast, RelativeLuminance } from "./utilities/relative-luminance";

/**
 * Options to tailer the generation of the color palette.
 * @public
 */
export interface PaletteOptions {
    /**
     * Increases the saturation of a color in the palette if it would otherwise be lower than the source color.
     */
    bumpSaturation: boolean;

    /**
     * The minimum amount of contrast between steps in the palette.
     */
    stepContrast: number;
}

const defaultPaletteOptions: PaletteOptions = {
    bumpSaturation: true,
    stepContrast: 1.06,
};

/**
 * A collection of {@link Swatch} instances
 * @public
 */
export interface Palette<T extends Swatch = Swatch> {
    readonly source: T;
    readonly swatches: ReadonlyArray<T>;

    /**
     * Returns a swatch from the palette that most closely matches
     * the contrast ratio provided to a provided reference.
     */
    colorContrast(
        reference: Swatch,
        contrast: number,
        initialIndex?: number,
        direction?: 1 | -1
    ): T;

    /**
     * Returns the index of the palette that most closely matches
     * the relativeLuminance of the provided swatch
     */
    closestIndexOf(reference: RelativeLuminance): number;

    /**
     * Gets a swatch by index. Index is clamped to the limits
     * of the palette so a Swatch will always be returned.
     */
    get(index: number): T;
}

/** @public */
export type PaletteRGB = Palette<SwatchRGB>;

/**
 * Creates a PaletteRGB from input R, G, B color values.
 * @param r - Red value represented as a number between 0 and 1.
 * @param g - Green value represented as a number between 0 and 1.
 * @param b - Blue value represented as a number between 0 and 1.
 */
function create(r: number, g: number, b: number): PaletteRGB;
/**
 * Creates a PaletteRGB from a source SwatchRGB object.
 * @deprecated - Use PaletteRGB.from()
 */
function create(source: SwatchRGB): PaletteRGB;
function create(rOrSource: SwatchRGB | number, g?: number, b?: number): PaletteRGB {
    if (typeof rOrSource === "number") {
        return PaletteRGB.from(SwatchRGB.create(rOrSource, g!, b!));
    } else {
        return PaletteRGB.from(rOrSource);
    }
}

/**
 * Creates a PaletteRGB from a source color object.
 * @param source - The source color
 */
function from(source: SwatchRGB, options?: Partial<PaletteOptions>): PaletteRGB;
function from(source: Pick<SwatchRGB, "r" | "g" | "b">, options?: Partial<PaletteOptions>): PaletteRGB {
    return isSwatchRGB(source)
        ? PaletteRGBImpl.from(source, options)
        : PaletteRGBImpl.from(SwatchRGB.create(source.r, source.g, source.b), options);
}
/** @public */
export const PaletteRGB = Object.freeze({
    create,
    from,
});

/**
 * A {@link Palette} representing RGB swatch values.
 * @public
 */
class PaletteRGBImpl implements Palette<SwatchRGB> {
    /**
     * {@inheritdoc Palette.source}
     */
    public readonly source: SwatchRGB;
    public readonly swatches: ReadonlyArray<SwatchRGB>;
    private lastIndex: number;
    private reversedSwatches: ReadonlyArray<SwatchRGB>;
    /**
     *
     * @param source - The source color for the palette
     * @param swatches - All swatches in the palette
     */
    constructor(source: SwatchRGB, swatches: ReadonlyArray<SwatchRGB>) {
        this.source = source;
        this.swatches = swatches;

        this.reversedSwatches = Object.freeze([...this.swatches].reverse());
        this.lastIndex = this.swatches.length - 1;
    }

    /**
     * {@inheritdoc Palette.colorContrast}
     */
    public colorContrast(
        reference: Swatch,
        contrastTarget: number,
        initialSearchIndex?: number,
        direction?: 1 | -1
    ): SwatchRGB {
        if (initialSearchIndex === undefined) {
            initialSearchIndex = this.closestIndexOf(reference);
        }

        let source: ReadonlyArray<SwatchRGB> = this.swatches;
        const endSearchIndex = this.lastIndex;
        let startSearchIndex = initialSearchIndex;

        if (direction === undefined) {
            direction = directionByIsDark(reference);
        }

        const condition = (value: SwatchRGB) =>
            contrast(reference, value) >= contrastTarget;

        if (direction === -1) {
            source = this.reversedSwatches;
            startSearchIndex = endSearchIndex - startSearchIndex;
        }

        return binarySearch(source, condition, startSearchIndex, endSearchIndex);
    }

    /**
     * {@inheritdoc Palette.get}
     */
    public get(index: number): SwatchRGB {
        return this.swatches[index] || this.swatches[clamp(index, 0, this.lastIndex)];
    }

    /**
     * {@inheritdoc Palette.closestIndexOf}
     */
    public closestIndexOf(reference: Swatch): number {
        const index = this.swatches.indexOf(reference as SwatchRGB);

        if (index !== -1) {
            return index;
        }

        const closest = this.swatches.reduce((previous, next) =>
            Math.abs(next.relativeLuminance - reference.relativeLuminance) <
            Math.abs(previous.relativeLuminance - reference.relativeLuminance)
                ? next
                : previous
        );

        return this.swatches.indexOf(closest);
    }

    /**
     * Gets the color with the requested or darker luminance.
     * @param lum Max requested luminance
     * @param palette Palette to search
     * @returns
     */
    private static maxRelativeLuminance(
        lum: number,
        palette: ColorRGBA64[]
    ): ColorRGBA64 {
        const color = palette.find(clr => rgbToRelativeLuminance(clr) <= lum);
        return color || palette[palette.length - 1];
    }

    /**
     * Bump the saturation if it falls below the reference color saturation.
     * @param reference Color with target saturation
     * @param color Color to check and bump if below target saturation
     * @returns
     */
    private static saturationBump(
        reference: ColorRGBA64,
        color: ColorRGBA64
    ): ColorRGBA64 {
        const hslReference = rgbToHSL(reference);
        const saturationTarget = hslReference.s;
        const hslColor = rgbToHSL(color);
        if (hslColor.s < saturationTarget) {
            const hslNew = new ColorHSL(hslColor.h, saturationTarget, hslColor.l);
            return hslToRGB(hslNew);
        }
        return color;
    }

    /**
     * Scales input from 0 to 100 to 0 to 0.5.
     * @param l Input number, 0 to 100
     * @returns Output number, 0 to 0.5
     */
    private static ramp(l: number) {
        const inputval = l / 100;
        if (inputval > 0.5) return (inputval - 0.5) / 0.5; //from 0.500001in = 0.00000001out to 1.0in = 1.0out
        return 2 * inputval; //from 0in = 0out to 0.5in = 1.0out
    }

    private static createSaturationPalette(
        baseColor: ColorRGBA64,
        bumpSaturation: boolean
    ): ColorRGBA64[] {
        const targetPalette: ColorRGBA64[] = [];

        const labBaseColor = rgbToLAB(baseColor);
        const lab0 = labToRGB(new ColorLAB(0, labBaseColor.a, labBaseColor.b)).clamp();
        const lab50 = labToRGB(new ColorLAB(50, labBaseColor.a, labBaseColor.b)).clamp();
        const lab100 = labToRGB(
            new ColorLAB(100, labBaseColor.a, labBaseColor.b)
        ).clamp();
        const rgbMin = new ColorRGBA64(0, 0, 0);
        const rgbMax = new ColorRGBA64(1, 1, 1);

        // 257 levels total
        for (let l = 114; l >= -14; l -= 0.5) {
            let rgb: ColorRGBA64;

            if (l < 0) {
                // For L less than 0, scale from black to L=0
                const percentFromRgbMinToLab0 = l / 14 + 1;
                rgb = interpolateRGB(percentFromRgbMinToLab0, rgbMin, lab0);
            } else if (l <= 50) {
                // For L less than 50, we scale from L=0 to the base color
                rgb = interpolateRGB(PaletteRGBImpl.ramp(l), lab0, lab50);
            } else if (l <= 100) {
                // For L less than 100, scale from the base color to L=100
                rgb = interpolateRGB(PaletteRGBImpl.ramp(l), lab50, lab100);
            } else {
                // For L greater than 100, scale from L=100 to white
                const percentFromLab100ToRgbMax = (l - 100.0) / 14;
                rgb = interpolateRGB(percentFromLab100ToRgbMax, lab100, rgbMax);
            }

            if (bumpSaturation) {
                rgb = PaletteRGBImpl.saturationBump(lab50, rgb);
            }
            rgb = rgb.roundToPrecision(4);

            targetPalette.push(rgb);
        }

        return targetPalette;
    }

    private static createColorPaletteByContrast(
        baseColor: ColorRGBA64,
        options: PaletteOptions
    ): ColorRGBA64[] {
        const referencePalette: ColorRGBA64[] = PaletteRGBImpl.createSaturationPalette(
            baseColor,
            options.bumpSaturation
        );

        const targetPalette: ColorRGBA64[] = [];
        targetPalette.push(referencePalette[0]);

        const steppedLum = (lum: number) => (lum + 0.05) / options.stepContrast - 0.05;

        let lum: number = 1;
        do {
            lum = steppedLum(lum);
            const peekLum = steppedLum(lum);
            // TODO: average the drop to black
            if (peekLum < 0) {
                lum = 0;
            }

            const refRgb = PaletteRGBImpl.maxRelativeLuminance(lum, referencePalette);
            if (lum > 0) {
                lum = rgbToRelativeLuminance(refRgb);
            }

            targetPalette.push(refRgb);
        } while (lum > 0);

        return targetPalette;
    }

    /**
     * Create a color palette from a provided swatch
     * @param source - The source swatch to create a palette from
     * @returns
     */
    static from(source: SwatchRGB, options?: Partial<PaletteOptions>): PaletteRGB {
        const opts =
            options === void 0 || null
                ? defaultPaletteOptions
                : { ...defaultPaletteOptions, ...options };

        return new PaletteRGBImpl(
            source,
            Object.freeze(
                PaletteRGBImpl.createColorPaletteByContrast(
                    ColorRGBA64.fromObject(source)!,
                    opts
                ).map(x => SwatchRGB.from(x))
            )
        );
    }
}

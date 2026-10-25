// ─────────────────────────────────────────────────────────────
// Laying references out like a moodboard.
//
// The first version drew every reference into a square frame, which
// squashed them. The second fitted each one inside its square, which
// stopped the distortion but left a tall shot stranded in a sea of white
// with the frame around nothing.
//
// References do not want to be uniform. So: rows of a common height and
// varying width, each row scaled to fill the page exactly — the shape a
// moodboard takes anyway. Nothing is cropped and nothing is stretched;
// only the row height moves.
//
// Pure geometry, no drawing, so it can be checked without a browser.
// ─────────────────────────────────────────────────────────────

export interface Placed {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutOptions {
  /** How tall a row would like to be before fitting is considered. */
  targetHeight: number;
  /** Ceiling, so one panoramic image cannot take half the page. */
  maxHeight: number;
  gap: number;
}

/**
 * Pack images into justified rows within a width.
 *
 * Aspect is width ÷ height. An image whose aspect cannot be determined is
 * given 1 (square), which is wrong but bounded — far better than dropping
 * it or letting a zero divide.
 */
export function layoutMoodboard(
  aspects: number[],
  width: number,
  options: LayoutOptions,
): { rows: Placed[][]; totalHeight: number } {
  const { targetHeight, maxHeight, gap } = options;
  const safe = aspects.map((a) => (Number.isFinite(a) && a > 0 ? a : 1));

  const rows: Placed[][] = [];
  let current: number[] = [];
  let y = 0;
  let totalHeight = 0;

  /** Scale a row so its images and gaps span the width exactly. */
  const flush = (indices: number[], isLast: boolean) => {
    if (indices.length === 0) return;
    const sumAspect = indices.reduce((s, i) => s + safe[i], 0);
    const available = width - gap * (indices.length - 1);

    // Every row is justified, including the last, capped so one panoramic
    // image cannot take half the page. An earlier version left the last row
    // at the target height, which looked wrong in the common case: four
    // tall references are a single row, and holding them at 32mm filled 73
    // of 180mm and read as a mistake rather than a choice.
    //
    // The last row is additionally never taller than the row above it. A
    // trailing image larger than the ones before it draws the eye to the
    // leftover rather than the work.
    const previous = rows.length > 0 ? rows[rows.length - 1][0].h : maxHeight;
    const justified = available / sumAspect;
    const height = isLast
      ? Math.min(justified, maxHeight, previous)
      : Math.min(justified, maxHeight);

    let x = 0;
    const placed: Placed[] = indices.map((i) => {
      const w = safe[i] * height;
      const rect = { index: i, x, y, w, h: height };
      x += w + gap;
      return rect;
    });
    rows.push(placed);
    y += height + gap;
    totalHeight = y - gap;
  };

  for (let i = 0; i < safe.length; i++) {
    const candidate = [...current, i];
    const sumAspect = candidate.reduce((s, j) => s + safe[j], 0);
    const widthAtTarget = sumAspect * targetHeight + gap * (candidate.length - 1);

    if (widthAtTarget > width && current.length > 0) {
      // This one tips the row over, so close the row without it.
      flush(current, false);
      current = [i];
    } else {
      current = candidate;
      // A single image already wider than the page closes its own row.
      if (widthAtTarget >= width) {
        flush(current, false);
        current = [];
      }
    }
  }

  flush(current, true);
  return { rows, totalHeight: Math.max(0, totalHeight) };
}

-- ═══════════════════════════════════════════════════════════════════
-- Moodboard blocks: notes, headings, lists and colour swatches.
--
-- The board was image-only. A board that can't carry a heading or a
-- colour reference forces the thinking into an email thread beside it,
-- which is where briefs go to die.
--
-- One table rather than a table per block type: they share position,
-- size and z-order, they are always read together as a board, and the
-- differences between them are entirely in what renders. `content` is
-- jsonb because a heading and a swatch have nothing in common to
-- normalise.
--
-- image_url becomes nullable — a sticky note has no image — and existing
-- rows are stamped 'image', which is what they all are.
--
-- SAFE TO RE-RUN.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.moodboard_items
  ADD COLUMN IF NOT EXISTS kind    TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS height  NUMERIC(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moodboard_items_kind_check'
  ) THEN
    ALTER TABLE public.moodboard_items
      ADD CONSTRAINT moodboard_items_kind_check
      CHECK (kind IN ('image', 'note', 'heading', 'list', 'swatch'));
  END IF;
END $$;

ALTER TABLE public.moodboard_items ALTER COLUMN image_url DROP NOT NULL;

-- An image block still has to have an image; everything else must not
-- pretend to be one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moodboard_items_image_present'
  ) THEN
    ALTER TABLE public.moodboard_items
      ADD CONSTRAINT moodboard_items_image_present
      CHECK (kind <> 'image' OR image_url IS NOT NULL);
  END IF;
END $$;
